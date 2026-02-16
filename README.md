# AWSサーバレスポートフォリオ  
（CloudFront + S3 + WAF + Lambda + API Gateway + CDK）

独自ドメインで公開したサーバレスWebサイトと問い合わせフォームをAWS上に構築しました。  
静的配信・セキュリティ・監視・IaC化まで含めて再現可能な形で整理しています。

---

## 🌍 公開サイト

- Webサイト: https://seiyachiba-portfolio.com

---

## 📌 アーキテクチャ概要

![アーキテクチャ図](diagrams/architecture.png)

---

## 🏗 構成要素

### 静的Web配信（フロント）

- Route53（独自ドメイン管理）
- CloudFront（CDN）
- S3（静的サイト格納）
- OACによりS3を完全非公開化

---

### 問い合わせフォーム（バックエンド）

- API Gateway（HTTP API）
- Lambda（問い合わせ処理）
- S3（問い合わせ内容をJSON保存）

---

### セキュリティ

- AWS WAF（CloudFrontに適用）
- Managed Rules + CloudWatch Logs Insights分析

---

### 監視・通知

- CloudWatch Logs / Alarm / Dashboard
- SNS通知（portfolio-alerts）

---

## 🛠 使用技術一覧

| 分野 | サービス |
|------|----------|
| 配信 | CloudFront / S3 |
| DNS | Route53 |
| API | API Gateway（HTTP API） |
| 処理 | Lambda |
| 保管 | S3（問い合わせログ） |
| 防御 | AWS WAF |
| 監視 | CloudWatch / SNS |
| IaC | AWS CDK（TypeScript） |

---

## 📦 IaC（AWS CDK）

本構成はAWS CDK（TypeScript）でIaC化しています。

CDKコード配置:

infrastructure/waf-cf-lambda-cdk/


---

## 🚀 デプロイ手順（再現可能）

```bash
cd infrastructure/waf-cf-lambda-cdk
npm install
npm run build
cdk deploy WafCfLambdaStackUsEast1
```

✅ 動作確認
Web配信確認

```bash
curl -I https://seiyachiba-portfolio.com
```

問い合わせAPI確認（例）

```bash
curl -X POST \
  https://{API_ID}.execute-api.ap-northeast-1.amazonaws.com/prod/contact \
  -H "content-type: application/json" \
  -d '{"name":"test","email":"test@example.com","message":"hello"}'
```

🧠 学びと工夫（運用視点）

CloudFront + OAC構成により、S3を完全非公開化しセキュアな配信を実現

WAFログをCloudWatch Logs Insightsで分析し、不審アクセス傾向を可視化

コンソール構築した環境をAWS CDK(TypeScript)でIaC化し再現性を確保

API Gatewayの500エラーをCloudWatch Logsで切り分ける運用手順を確立

📌 今後の改善予定

Lambda処理のテスト整備と安定運用

docs/ に運用手順・障害対応フローを体系化

CI/CD（GitHub Actions）による自動デプロイ検討

📘 ドキュメント

運用メモ（Operations）

障害対応メモ（Troubleshooting）
