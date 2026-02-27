# Troubleshooting（障害対応の手順）

このドキュメントは、私のポートフォリオ
の環境で障害が起きたときに最短で原因へ到達するための切り分け手順をまとめたものです。
基本的な失敗をはじめ、ＩＴＩＬ運用の思考を参考にして、
工夫して１つ１つ原因を切り分け→調査して直して対応したものになります。

#  ポートフォリオの構成
（ https://seiyachiba-portfolio.com ）

- CloudFront + S3（静的サイト配信）
- API Gateway（HTTP API）
- Lambda（問い合わせ処理）
- S3（問い合わせログ保存）
- AWS WAF（CloudFront前段）
- CloudWatch Logs / Alarm

# 目次
# 1. 障害対応の基本方針
# 2. よくある障害
# 3. Lambda障害
# 4. WAFが弾いているケース
# 5. 障害対応の結論の記録形式

---


## 最初に必ずやること
→どの階層で起こっているのか切り分け意識を持つ。

今回はクラウドアーキテクチャなので、

1. 入口で止まっているのか？
2. 中身（Lambda）で落ちているのか？
3. 設定ミスか？権限か？コードか？

から意識する。基本的に障害はほぼこの3つに分類できる。

---

# 2. よくある障害

---

## 2.1 Webサイトが開かない（CloudFront）

### 症状例

- ブラウザで真っ白になる
- 403 AccessDenied
- 404 Not Found
- 502 Bad Gateway

---

### 切り分け手順

#### Step1：CloudFront疎通確認

```bash
curl -I https://seiyachiba-portfolio.com
```

見るべきポイント：

HTTPステータス（200/403/404/502）

レスポンスヘッダにvia: cloudfront があるか
（CloudFront を経由して返されたという意味）

Step2：403の場合（S3が非公開になりやすい設定になっている）

原因候補：

OACの設定ミス

S3バケットポリシーが不足していた

Default root object を未設定

確認：

CloudFront → Default root object = index.html

S3 → Public Access Block ON（正常）

CloudFront OAC → S3許可ポリシーがあるか

Step3：404の場合（万が一ファイル自体が無い場合）

原因候補：

S3に index.html が存在しない

又はパスが間違っている

確認：

S3バケットに index.html があるか

## 2.2 問い合わせフォームが送信できない（API Gateway）
症状例

POSTすると失敗する

ブラウザで「送信できません」

curlで 500 が返る

Step1：API Gatewayが動いているか確認

```bash
curl -X POST \
  https://wl8x8hrpfc.execute-api.ap-northeast-1.amazonaws.com/prod/contact \
  -H "content-type: application/json" \
  -d '{"name":"test","email":"test@example.com","message":"hello"}'
```

通信応答を結果別に記します。

〇 200　→OK

API GatewayもLambdaも正常。

✕ 500 Internal Server Error

ならば原因はLambda。（ほぼ確実だと思います。）

✕ 403 Forbidden

原因候補：

IAMの権限不足

LambdaがS3 PutObjectできない

✕ CORS error（ブラウザ経由のアクセスからは失敗）

原因候補：

API GatewayのCORS設定不足

確認：

Allowed Origin に以下があるかを確認

```bash
https://seiyachiba-portfolio.com
```
```bash
https://www.seiyachiba-portfolio.com
```

# 3. Lambda障害
## 3.1 Lambdaのログを見る
CloudWatch Logsを参照する

AWS Console → Lambda → portfolio-contact-handler → Monitor → Logs

## 3.2 ログの読み方

Lambdaログは必ずこの順で見る：

REPORT

END

START

スタックトレース

1実行はこの単位

START RequestId ...
（処理ログ）
ERROR ...
END RequestId ...
REPORT RequestId ...

この塊を1つ切り出して見る。

## 3.3 典型的な原因
パターン1：eventの中身が想定したものと違っていた

例：

event.body が空

JSON.parseで落ちる
（文字列として受け取ったデータが 
“正しいJSON形式ではない” 
ために例外が発生しているという意味。）

対策：

```js
console.log("event =", JSON.stringify(event))
```

パターン2：S3 PutObject権限の不足

例：

```text
AccessDenied: not authorized to perform s3:PutObject
```

対策：

IAMロールに以下が必要：

s3:PutObject

対象バケットのみ許可

パターン3：環境変数が無い

例：

CONTACT_BUCKET is undefined

対策：

Lambda環境変数を確認：

CONTACT_BUCKET=seiyachiba-contact-logs

# 4. WAFが弾いているケース
症状

特定のIPだけアクセスできない

403が返る

確認方法

CloudWatch Logs InsightsでBLOCKを見る：

```sql
fields @timestamp, action, httpRequest.clientIp, terminatingRuleId
| filter action="BLOCK"
| sort @timestamp desc
| limit 20
```


見るべきもの：

clientIp

terminatingRuleId（どのルールで止まったかを見る）

# 5. 障害対応の結論の記録形式

障害報告はこうまとめる。報告の際は結論から伝えること。

日時：

症状：

入口：

原因：

対応：

再発防止：

例：

「API Gatewayは正常だがLambdaで例外発生したため調査。
　原因はS3 PutObject権限の不足。
　IAMを修正後に復旧を確認済み。再発防止としてCloudWatch Alarmを追加し運用中。」


 以上
