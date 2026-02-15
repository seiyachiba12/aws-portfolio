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
