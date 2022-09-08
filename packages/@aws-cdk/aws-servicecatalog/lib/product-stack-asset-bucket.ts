import * as cdk from '@aws-cdk/core';
import { IBucket, BlockPublicAccess, Bucket } from '../../aws-s3';
import { BucketDeployment, ISource, Source } from '../../aws-s3-deployment';
import { Construct, IConstruct } from 'constructs';
import { hashValues } from './private/util';

/**
 * Product stack asset bucket props.
 */
export interface ProductStackAssetBucketProps {
  /**
   * Name of s3 asset bucket deployed
   *
   * @default -
   */
  readonly assetBucketName?: string;
}

/**
 * A Service Catalog product stack asset bucket, which is similar in form to an Amazon S3 bucket.
 * You can store multiple product stack assets and collectively deploy them to S3.
 */
export class ProductStackAssetBucket extends Construct {
  private readonly bucketName: string;
  private readonly bucket: IBucket;
  private readonly assets: ISource[];

  constructor(scope: Construct, id: string, props: ProductStackAssetBucketProps = {}) {
    super(scope, id);

    if (props.assetBucketName) {
      this.bucketName = props.assetBucketName;
    } else {
      this.bucketName = this.generateBucketName(id);
    }

    this.bucket = new Bucket(scope, `${id}S3Bucket`, {
      bucketName: this.bucketName,
      blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
    });

    this.assets = [];

    cdk.Aspects.of(this).add({
      visit(c: IConstruct) {
        if (c instanceof ProductStackAssetBucket) {
          c.deployAssets();
        };
      },
    });
  }

  /**
   * Fetch the S3 bucket.
   *
   * @internal
   */
  public _getBucket(): IBucket {
    return this.bucket;
  }

  /**
   * Generate unique name for S3 bucket.
   *
   * @internal
   */
  private generateBucketName(id: string): string {
    const accountId = cdk.Stack.of(this).account;
    if (cdk.Token.isUnresolved(accountId)) {
      throw new Error('CDK Account ID must be defined in the application environment');
    }
    return `product-stack-asset-bucket-${accountId}-${hashValues(id)}`;
  }

  /**
   * Fetch the expected S3 location of an asset.
   *
   * @internal
   */
  public _addAsset(asset: cdk.FileAssetSource): cdk.FileAssetLocation {
    const assetPath = './cdk.out/' + asset.fileName;
    this.assets.push(Source.asset(assetPath));

    const bucketName = this.bucketName;
    const s3Filename = asset.fileName?.split('.')[1] + '.zip';
    const objectKey = `${s3Filename}`;
    const s3ObjectUrl = `s3://${bucketName}/${objectKey}`;
    const httpUrl = `https://s3.${bucketName}/${objectKey}`;

    return { bucketName, objectKey, httpUrl, s3ObjectUrl, s3Url: httpUrl };
  }

  /**
   * Deploy all assets to S3.
   *
   * @internal
   */
  private deployAssets() {
    if (this.assets.length > 0) {
      new BucketDeployment(this, 'AssetsBucketDeployment', {
        sources: this.assets,
        destinationBucket: this.bucket,
        unzipFile: false,
      });
    }
  }
}