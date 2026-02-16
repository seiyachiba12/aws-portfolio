import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as wafv2 from 'aws-cdk-lib/aws-wafv2';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as logs from 'aws-cdk-lib/aws-logs';

export class EdgeStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // 1) Lambda（最小: Hello）
    const fn = new lambda.Function(this, 'AppFunction', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'index.handler',
      code: lambda.Code.fromInline(`
        exports.handler = async (event) => {
          console.log("event:", JSON.stringify(event));
          return {
            statusCode: 200,
            headers: {"content-type": "application/json; charset=utf-8"},
            body: JSON.stringify({ ok: true, message: "hello from lambda behind cloudfront+waf" }),
          };
        };
      `),
    });

    // Lambda Logs retention（自動生成ロググループに適用）
    new logs.LogRetention(this, 'FnLogRetention', {
      logGroupName: `/aws/lambda/${fn.functionName}`,
      retention: logs.RetentionDays.TWO_WEEKS,
    });

    // 2) Lambda Function URL（CloudFrontのオリジン）
    const fnUrl = fn.addFunctionUrl({
      authType: lambda.FunctionUrlAuthType.NONE, // デモ用
    });


    // 3) WAFv2（CLOUDFRONT / us-east-1）
   const blockTestUserAgentRule: wafv2.CfnWebACL.RuleProperty = {
	     name: 'Block-Test-UserAgent',
	      priority: 0,
	       action: { block: {} },
	       statement: {
	       byteMatchStatement: {
	             searchString: 'attack-test',
	           fieldToMatch: {
	           singleHeader: { name: 'user-agent' },
			         },
	       positionalConstraint: 'EXACTLY',
	       textTransformations: [
	             { priority: 0, type: 'NONE' },
			           ],
			       },
		         },
		   visibilityConfig: {
	      cloudWatchMetricsEnabled: true,
	           metricName: 'BlockTestUserAgent',
	    sampledRequestsEnabled: true,
			         },
   };


    const webAcl = new wafv2.CfnWebACL(this, 'WebAcl', {
      name: 'portfolio-waf-cf',
      scope: 'CLOUDFRONT',
      defaultAction: { allow: {} },
      visibilityConfig: {
        cloudWatchMetricsEnabled: true,
        metricName: 'portfolioWaf',
        sampledRequestsEnabled: true,
      },
      rules: [
      blockTestUserAgentRule,
	      {
          name: 'AWSManagedRulesCommonRuleSet',
          priority: 1,
          overrideAction: { none: {} },
          statement: {
            managedRuleGroupStatement: {
              vendorName: 'AWS',
              name: 'AWSManagedRulesCommonRuleSet',
            },
          },
          visibilityConfig: {
            cloudWatchMetricsEnabled: true,
            metricName: 'CommonRuleSet',
            sampledRequestsEnabled: true,
          },
        },
      ],
    });
   
    

    // --- 4) WAF Logs (CloudWatch Logs) ---
    // WAFの正式ログ（Full logs）をCloudWatch Logsへ送る設定
   
    const wafLogGroup = new logs.LogGroup(this, 'WafLogGroup', {
	      // ✅ 必ず aws-waf-logs- で開始
	       logGroupName: 'aws-waf-logs-portfolio-waf-cf',
	         retention: logs.RetentionDays.TWO_WEEKS,
	           removalPolicy: cdk.RemovalPolicy.DESTROY,
	          });

    // WAFログ配送サービスがLogGroupに書き込めるようにResource Policyを付与
    new logs.CfnResourcePolicy(this, 'WafLogsResourcePolicy', {
      policyName: 'AWSWAF-Logging-Policy',
      policyDocument: JSON.stringify({
        Version: '2012-10-17',
        Statement: [
          {
            Sid: 'AWSWAFLoggingPermissions',
            Effect: 'Allow',
            Principal: { Service: 'delivery.logs.amazonaws.com' },
            Action: ['logs:CreateLogStream', 'logs:PutLogEvents'],
            Resource: `${wafLogGroup.logGroupArn}:*`,
            Condition: {
              StringEquals: { 'aws:SourceAccount': this.account },
              ArnLike: { 'aws:SourceArn': `arn:aws:logs:${this.region}:${this.account}:*` },
            },
          },
        ],
      }),
    });

// 3.5) WAF Full Logs -> CloudWatch Logs
     new wafv2.CfnLoggingConfiguration(this, 'WafLogging', {
	       resourceArn: webAcl.attrArn,
	         logDestinationConfigs: [
			     `arn:aws:logs:${this.region}:${this.account}:log-group:${wafLogGroup.logGroupName}`,
			       ],
     });
         

    // 5) CloudFront Distribution（origin = Lambda URL）
    const originDomain = cdk.Fn.select(2, cdk.Fn.split('/', fnUrl.url));
    const origin = new origins.HttpOrigin(originDomain, {
      protocolPolicy: cloudfront.OriginProtocolPolicy.HTTPS_ONLY,
    });

    const dist = new cloudfront.Distribution(this, 'Distribution', {
      defaultBehavior: {
        origin,
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
      },
      webAclId: webAcl.attrArn,
      comment: 'WAF + CloudFront + Lambda(Function URL) via CDK',
    });

    new cdk.CfnOutput(this, 'CloudFrontDomain', { value: dist.domainName });
    new cdk.CfnOutput(this, 'LambdaFunctionUrl', { value: fnUrl.url });
    new cdk.CfnOutput(this, 'WebAclArn', { value: webAcl.attrArn });
    new cdk.CfnOutput(this, 'WafLogGroupName', { value: wafLogGroup.logGroupName });
  }
}
