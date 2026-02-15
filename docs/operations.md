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
