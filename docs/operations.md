# Operations（運用メモ）

このドキュメントは、AWSポートフォリオ（CloudFront + S3 + WAF + API Gateway + Lambda）の運用手順を、第三者が見ても再現・運用できる形でまとめたものです。

---

## 1. 対象システム

- 公開サイト: https://seiyachiba-portfolio.com
- 静的配信: CloudFront + S3（OACでS3非公開）
- 問い合わせAPI: API Gateway（HTTP API）→ Lambda → S3（問い合わせログ保存）
- セキュリティ: AWS WAF（CloudFrontに適用）
- 監視: CloudWatch（Logs / Alarm / Dashboard）+ SNS通知（portfolio-alerts）

---

## 2. 監視対象（何を見るか）

- CloudFront アクセス状況（異常な4xx/5xx、急増）
- API Gateway 5xx エラー（バックエンド障害の入口）
- Lambda Errors（実処理の例外）
- WAF BLOCKログ（攻撃・誤検知の傾向）

---

## 3. CloudWatchで見る場所（どこを見るか）

- CloudWatch Logs → Lambda実行ログ
- CloudWatch Metrics → API Gateway / Lambda
- CloudWatch Alarms → しきい値超過の通知
- SNS → `portfolio-alerts`（メール通知）

---

## 4. 日次チェック（5分）

### 4.1 Web疎通

```bash
curl -I https://seiyachiba-portfolio.com
```

期待値（例）

HTTP/2 200 または 304

via: ...cloudfront... が含まれる

### 4.2 問い合わせAPI疎通

```bash
curl -X POST \
  https://wl8x8hrpfc.execute-api.ap-northeast-1.amazonaws.com/prod/contact \
  -H "content-type: application/json" \
  -d '{"name":"test","email":"test@example.com","message":"hello"}'
```

### 4.3 問い合わせログ（S3）確認

問い合わせ送信後、問い合わせ保存用S3バケット（seiyachiba-contact-logs）にJSONが追加されていること

## 5. 監視（CloudWatch）
### 5.1 確認するもの

CloudWatch Dashboard: portfolio-contact-monitor

Alarm（例）

Lambda-portfolio-contact-handler-Errors

APIGW-5xx-portfolio-contact-api-prod

APIGW-4xxSpike-portfolio-contact-api-prod（4xxはスパイク検知運用）

### 5.2 アラート通知

SNS Topic: portfolio-alerts（メール通知）

## 6. WAF運用（CloudFront前段）
### 6.1 方針

まずはManaged Rules中心で広く防御

必要に応じてIPブロックやRate-basedで追加防御

ログをCloudWatch Logs Insightsで集計し、根拠を持って調整

### 6.2 Logs Insights（集計例）

※ロググループ名は環境に合わせて選択（例: aws-waf-logs-portfolio-waf-cf）

BLOCKされたIPランキング

```sql
fields @timestamp, action, httpRequest.clientIp
| filter action = "BLOCK"
| stats count() as cnt by httpRequest.clientIp
| sort cnt desc
| limit 20
```

BLOCKされたルールランキング

```sql
fields @timestamp, action, terminatingRuleId
| filter action = "BLOCK"
| stats count() as cnt by terminatingRuleId
| sort cnt desc
| limit 20
```

URI別のBLOCK傾向

```sql
fields @timestamp, action, httpRequest.uri
| filter action = "BLOCK"
| stats count() as cnt by httpRequest.uri
| sort cnt desc
| limit 20
```

## 7. デプロイ（手動：CloudShell）
### 7.1 前提

CDKコードは infrastructure/waf-cf-lambda-cdk/ 配下

CloudFront + WAF（グローバル相当）は us-east-1 を利用する構成

### 7.2 ビルド

cd ~/aws-portfolio/infrastructure/waf-cf-lambda-cdk
npm ci
npm run build

### 7.3 デプロイ

cdk deploy WafCfLambdaStackUsEast1 --require-approval never

## 8. 障害対応（入口）
### 8.1 Webが見れない場合
1. CloudFrontのエラー（403/404/502）を確認  
2. S3(OAC)設定と Default root object（index.html）を確認  

### 問い合わせが失敗する場合（500）
1. API Gatewayは入口なのでLambda例外を疑う  
2. CloudWatch LogsでSTART/END/REPORTを確認  


### 8.2 Lambdaログの見方（1実行を切り出す）

START RequestId ...

例外（スタックトレース、エラーログ）

END RequestId ...

REPORT RequestId ...

スタックトレースがあれば、行番号・キー不足・権限不足（S3 PutObject等）を優先して潰す。

## 9. 変更管理（最低限）

変更前に影響範囲を一言でメモ（READMEの変更履歴でも可）

デプロイ後に以下を必ず確認

curl -I のWeb疎通

問い合わせAPI疎通

CloudWatch Alarmの異常が出ていないこと

WAFログの急増がないこと

