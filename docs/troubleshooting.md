# 障害対応メモ（Troubleshooting）

## APIが500になる場合

### 切り分け

- curlでも500 → Lambda側例外の可能性が高い
- OPTIONSが204 → CORSは正常

### 確認手順

1. CloudWatch Logsを開く
2. START → ERROR → REPORT を1実行単位で確認
3. eventをログ出力して入力内容を確認する

---

## CloudFrontでAccessDeniedになる場合

- Default root object が index.html になっているか確認
- OAC設定とBucket Policyを確認

---

## WAFでBLOCKが増える場合

- CloudWatch Logs Insightsで clientIp と terminatingRuleId を確認する

# Troubleshooting（障害対応手順）

このドキュメントは、本ポートフォリオ環境で障害が起きたときに  
最短で原因へ到達するための切り分け手順をまとめたものです。

対象構成：

- CloudFront + S3（静的サイト配信）
- API Gateway（HTTP API）
- Lambda（問い合わせ処理）
- S3（問い合わせログ保存）
- AWS WAF（CloudFront前段）
- CloudWatch Logs / Alarm

---

# 1. 障害対応の基本方針

## 最初に必ずやること

1. 入口で止まっているのか？
2. 中身（Lambda）で落ちているのか？
3. 設定ミスか？権限か？コードか？

障害はほぼこの3つに分類できる。

---

# 2. よくある障害パターン

---

## 2.1 Webサイトが開かない（CloudFront）

### 症状例

- ブラウザで真っ白
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

via: cloudfront があるか

Step2：403の場合（S3が非公開すぎる）

原因候補：

OAC設定ミス

S3バケットポリシー不足

Default root object が未設定

確認：

CloudFront → Default root object = index.html

S3 → Public Access Block ON（正常）

CloudFront OAC → S3許可ポリシーがあるか

Step3：404の場合（ファイルが無い）

原因候補：

S3に index.html が存在しない

パスが間違っている

確認：

S3バケットに index.html があるか

2.2 問い合わせフォームが送信できない（API Gateway）
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

結果別に分岐
✅ 200ならOK

API GatewayもLambdaも正常。

❌ 500 Internal Server Error

ほぼ確実に原因はLambda。

次へ。

❌ 403 Forbidden

原因候補：

IAM権限不足

LambdaがS3 PutObjectできない

❌ CORS error（ブラウザだけ失敗）

原因候補：

API GatewayのCORS設定不足

確認：

Allowed Origin に以下があるか

```bash
https://seiyachiba-portfolio.com
https://www.seiyachiba-portfolio.com
```

3. Lambda障害（最重要）
3.1 Lambdaのログを見る
CloudWatch Logsへ行く場所

AWS Console → Lambda → portfolio-contact-handler → Monitor → Logs

3.2 ログの読み方（鉄板）

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

この塊を1つ切り出す。

3.3 典型的な原因
パターン1：eventの中身が想定と違う

例：

event.body が空

JSON.parseで落ちる

対策：

console.log("event =", JSON.stringify(event))

パターン2：S3 PutObject権限不足

例：

```bash
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

4. WAFが弾いているケース
症状

特定のIPだけアクセスできない

403が返る

確認方法

CloudWatch Logs InsightsでBLOCKを見る：

```md
fields @timestamp, action, httpRequest.clientIp, terminatingRuleId
| filter action="BLOCK"
| sort @timestamp desc
| limit 20
```


見るべきもの：

clientIp

terminatingRuleId（どのルールで止まったか）

5. 障害対応の結論テンプレ

障害報告はこうまとめる：

症状：

入口：

原因：

対応：

再発防止：

例：

「API Gatewayは正常だがLambdaで例外発生。原因はS3 PutObject権限不足。
IAM修正後に復旧。再発防止としてCloudWatch Alarmを追加。」

6. 次に強化する改善案

Lambda例外をSlack/SNS通知する

APIのバリデーション追加

WAF Rate-based rule追加

IaCで完全再現（CDK一本化）



