## 👋 自己紹介

AWSを中心にクラウドインフラを学習しており、  
サーバレス構成のポートフォリオを個人で構築しています。

## ☁️ 主な取り組み

- CloudFront + S3（OAC）による静的サイト配信
- API Gateway + Lambda による問い合わせAPI
- AWS WAF + CloudWatch によるセキュリティ監視
- AWS CDK（TypeScript）でIaC化して再現可能に整理

## 🔗 ポートフォリオリンク

- 公開サイト：https://seiyachiba-portfolio.com  
- GitHub（メイン）：https://github.com/seiyachiba12/aws-portfolio
- 
## AWSサーバレスポートフォリオ  
（CloudFront + S3 + WAF + Lambda + API Gateway + CDK）

AWS上で独自ドメイン付きのサーバレスWebシステムを構築しました。  
CloudFront + OACによるセキュア配信、WAFによる防御、CloudWatchによる監視運用、  
API Gateway + Lambdaによる問い合わせ処理まで実装し、  
運用・障害対応手順も含めてCDKで再現可能な形にまとめています。

---

## 📌 目的（実務スキル証明）

本ポートフォリオは、クラウド運用エンジニアとして必要な

- セキュアな配信設計（CloudFront + OAC）
- サーバレスAPI構築（API Gateway + Lambda）
- 監視と障害切り分け（CloudWatch Logs / Alarm）
- IaCによる再現性確保（AWS CDK）

を一通り実装し、実務スキルとして証明する目的で作成しました。

---


## 🌍 公開サイト

- Webサイト: https://seiyachiba-portfolio.com

---

## 📌 アーキテクチャ概要

ユーザーアクセスはCloudFrontで受け、OAC経由で非公開S3へ配信します。  
問い合わせはAPI Gateway → Lambda → S3に保存され、CloudWatchで監視します。

![アーキテクチャ図](diagrams/architecture.png)

---

## 設計で意識したこと

- CloudFront + OACによりS3を完全非公開化し、静的サイトでもセキュリティを担保
- WAF Managed Rulesを導入し、不審アクセスをCloudWatch Logs Insightsで分析可能にした
- API障害時は「入口(API GW)」と「実処理(Lambda)」をログで切り分けられる構成にした
- CloudWatch Alarm + SNS通知で運用監視まで含めた

---
## 運用・障害対応ドキュメント（強すぎる武器）

本環境は「作って終わり」ではなく、運用を前提に以下を整備しています。

- 日次監視手順（Operations）
- API 500 / AccessDenied の切り分け（Troubleshooting）

---

## 📂 Repository Structure

- diagrams/ : アーキテクチャ図
- docs/     : 運用・障害対応手順
- infrastructure/ : AWS CDKコード

- CDK code is located here:

infrastructure/waf-cf-lambda-cdk/

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

## 📦 IaC（AWS CDK）の再現性

本構成はAWS CDK（TypeScript）でIaC化しており、  
CloudShell上で同一環境を再現できます。


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

## ✅ 動作確認
Web配信確認

```bash
curl -I https://seiyachiba-portfolio.com
```

## 問い合わせAPI確認（例）

```bash
curl -X POST \
  https://{API_ID}.execute-api.ap-northeast-1.amazonaws.com/prod/contact \
  -H "content-type: application/json" \
  -d '{"name":"test","email":"test@example.com","message":"hello"}'
```

---

## 🧠 学びと工夫（運用視点）

CloudFront + OAC構成により、S3を完全非公開化しセキュアな配信を実現

WAFログをCloudWatch Logs Insightsで分析し、不審アクセス傾向を可視化

コンソール構築した環境をAWS CDK(TypeScript)でIaC化し再現性を確保

API Gatewayの500エラーをCloudWatch Logsで切り分ける運用手順を確立

---

## 🔥 トラブルシューティング経験（実務想定）

本構成では、構築中に実際に以下の障害が発生しました。

### ケース：問い合わせAPIが常に500になる

#### 症状
- フロントから送信すると `500 Internal Server Error`
- curlでも同様に500

#### 切り分け
- OPTIONSは204で返っていたためCORSではない
- API Gatewayは入口であり、原因はLambda側例外と判断

#### 対応
- CloudWatch Logsで `START → ERROR → REPORT` を1実行単位で確認
- event入力や環境変数不足を特定し修正

#### 学び
- API障害では「入口(API Gateway)」と「実処理(Lambda)」を分離して考える
- CloudWatch Logsを使った障害切り分けは運用で必須

---

### ケース：CloudFrontでAccessDenied（403）

#### 症状
- ブラウザで `AccessDenied`

#### 原因
- Default root object未設定によりS3側で拒否されていた

#### 対応
- CloudFrontに `index.html` をDefault root objectとして設定し解決

#### 学び
- OAC構成では「S3が公開されないのが正常」
- CloudFront側の設定が入口になる

---

## 🛣 今後の拡張ロードマップ（運用改善）

本ポートフォリオは「構築して終わり」ではなく、  
実務運用を想定して継続的に改善できる形を目指しています。

### Phase 1：安定運用（短期）
- Lambda処理の例外ハンドリング強化
- API入力バリデーション追加
- CloudWatch Alarmの閾値調整と通知精度向上

### Phase 2：運用自動化（中期）
- GitHub ActionsによるCI/CD導入（CDK deploy自動化）
- デプロイ前後の自動テスト（curl / Lambda unit test）

### Phase 3：セキュリティ強化（中長期）
- WAF Rate-based rule導入によるDoS対策
- 監査ログ（CloudTrail）との統合
- IAM最小権限ポリシーの継続改善

### Phase 4：IaC統一（長期）
- コンソール構築部分も含めてCDKで完全再現
- マルチスタック構成の整理（Global / Regional分離）

---

## 📘 運用ドキュメント

運用・障害対応手順は以下に整理しています。

- [運用メモ（Operations）](docs/operations.md)
- [障害対応メモ（Troubleshooting）](docs/troubleshooting.md)
