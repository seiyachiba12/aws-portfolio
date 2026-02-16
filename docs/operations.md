# 運用メモ（Operations）

## 監視対象

- CloudFront アクセス状況
- API Gateway 5xx エラー
- Lambda Errors
- WAF BLOCKログ

## CloudWatchで見る場所

- Logs → Lambda実行ログ
- Metrics → API Gateway / Lambda
- Alarm → portfolio-alerts 通知

## 日次チェック

- エラー増加がないか
- WAFで異常なIPが増えていないか
- 問い合わせログがS3に保存されているか

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

## 2. 日次チェック（5分）

### 2.1 Web疎通
```bash
curl -I https://seiyachiba-portfolio.com

期待値（例）

HTTP/2 200 または 304

via: ...cloudfront... が含まれる

2.2 問い合わせAPI疎通

curl -X POST \
  https://wl8x8hrpfc.execute-api.ap-northeast-1.amazonaws.com/prod/contact \
  -H "content-type: application/json" \
  -d '{"name":"test","email":"test@example.com","message":"hello"}'

3. 監視（CloudWatch）
3.1 確認するもの

CloudWatch Dashboard: portfolio-contact-monitor

Alarm（例）

Lambda-portfolio-contact-handler-Errors

APIGW-5xx-portfolio-contact-api-prod

APIGW-4xxSpike-portfolio-contact-api-prod（スパイク検知）

3.2 アラート通知

SNS Topic: portfolio-alerts（メール通知）

4. WAF運用（CloudFront前段）
4.1 方針

まずはManaged Rules中心で広く防御

必要に応じてIPブロックやRate-basedで追加防御

ログをCloudWatch Logs Insightsで集計し、根拠を持って調整

4.2 WAFログ（CloudWatch Logs Insights）でよく見る集計例

※ロググループ名は環境の設定に合わせて選択（例: aws-waf-logs-portfolio-waf-cf）

BLOCKされたIPランキング

fields @timestamp, action, httpRequest.clientIp
| filter action = "BLOCK"
| stats count() as cnt by httpRequest.clientIp
| sort cnt desc
| limit 20

BLOCKされたルールランキング

fields @timestamp, action, terminatingRuleId
| filter action = "BLOCK"
| stats count() as cnt by terminatingRuleId
| sort cnt desc
| limit 20

URI別のBLOCK傾向

fields @timestamp, action, httpRequest.uri
| filter action = "BLOCK"
| stats count() as cnt by httpRequest.uri
| sort cnt desc
| limit 20

5. デプロイ（手動：CloudShellで実施）
5.1 前提

CDKコードは infrastructure/waf-cf-lambda-cdk/ 配下

CloudFront + WAF（グローバル相当）は us-east-1 を利用する構成

5.2 ビルド

cd ~/aws-portfolio/infrastructure/waf-cf-lambda-cdk
npm ci
npm run build

5.3 デプロイ

cdk deploy WafCfLambdaStackUsEast1 --require-approval never

6. 障害対応（入口）
6.1 症状別の最短ルート

Webが見れない

CloudFrontのエラー（403/404/502）か確認

S3（OAC）設定、Default root object（index.html）を確認

問い合わせが失敗（500）

API Gatewayは「入口」で、原因はLambda例外のことが多い

CloudWatch LogsでLambdaのSTART/END/REPORTを1実行単位で確認

6.2 Lambdaログの見方（1実行を切り出す）

START RequestId ...

例外（スタックトレース、エラーログ）

END RequestId ...

REPORT RequestId ...

スタックトレースがあれば、行番号・キー不足・権限不足（S3 PutObject等）を優先して潰す。

7. 変更管理（最低限）

変更前に影響範囲を一言でメモ（READMEの変更履歴でも可）

デプロイ後に以下を必ず確認

curl -I のWeb疎通

問い合わせAPI疎通

CloudWatch Alarmの異常が出ていないこと

WAFログの急増がないこと

