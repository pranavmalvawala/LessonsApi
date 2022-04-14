import AWS from "aws-sdk";
import { Repositories } from "../repositories/Repositories";
import { File, Variant, Resource } from "../models";
import { Environment, FilesHelper } from ".";
import { AwsHelper } from "../apiBase";

export class TranscodeHelper {

  static zeroPad(num: number, places: number) {
    return String(num).padStart(places, '0')
  }

  static async deleteThumbs(s3Path: string) {
    const files = await AwsHelper.S3List(s3Path);
    const toDelete: string[] = [];
    files.forEach(f => { if (f.indexOf("thumb-") > -1) toDelete.push(f); });
    const promises: Promise<void>[] = []
    toDelete.forEach(d => promises.push(AwsHelper.S3Remove(d)));
    await Promise.all(promises);
  }

  static async handlePingback(data: any): Promise<void> {
    try {
      const messageString = data.Records[0].Sns.Message;
      const message: any = JSON.parse(messageString);
      const webmPath = message.outputKeyPrefix;
      const parts = webmPath.split("/");
      const resourceId = parts[3];
      const webmName = message.outputs[0].key;
      const seconds = message.outputs[0].duration;
      const dateModified = new Date();
      const contentPath = Environment.contentRoot + "/" + webmPath + webmName + "?dt=" + dateModified.getTime().toString();
      const size = 0;

      let thumbMid = Math.floor(seconds / 15);
      if (thumbMid !== 1) thumbMid = Math.floor(thumbMid / 2);
      const thumbName = (thumbMid === 0) ? ""
        : webmName.replace(".webm", "thumb-" + String(thumbMid).padStart(5, '0') + ".png")

      const finalThumbName = webmName.replace(".webm", "-thumb.png");

      await AwsHelper.S3Rename(webmPath + thumbName, webmPath + finalThumbName);
      await this.deleteThumbs(webmPath);
      const repo = Repositories.getCurrent();
      const resource: Resource = await repo.resource.loadWithoutChurchId(resourceId);

      let file: File = { churchId: resource.churchId, fileName: webmName, contentPath, fileType: "video/webm", size, dateModified, seconds, thumbPath: Environment.contentRoot + "/" + webmPath + finalThumbName }
      file = await repo.file.save(file);

      const variant: Variant = { churchId: resource.churchId, resourceId, fileId: file.id, name: "WEBM", downloadDefault: false, playerDefault: true, hidden: true }
      await repo.variant.save(variant);

      await FilesHelper.updateSize(file);


    } catch (e) {
      console.log(e);
    }

  }


  private static getEncoder() {
    const config: AWS.ElasticTranscoder.ClientConfiguration = {
      apiVersion: "2012-09-25",
      region: "us-east-1",
    }
    return new AWS.ElasticTranscoder(config)
  }

  static async encodeWebm(sourcePath: string, destPath: string, destFile: string) {

    /*
    const existing = await AwsHelper.S3Read(destPath + destFile);
    if (existing) await AwsHelper.S3Remove(destPath + destFile);*/
    try {
      await AwsHelper.S3Remove(destPath + destFile);
    } catch (ex) {
      console.log(ex);
    }

    const thumbPattern = destFile.replace(".webm", "thumb-{count}");
    const params: AWS.ElasticTranscoder.CreateJobRequest =
    {
      PipelineId: Environment.transcodePipeline,
      OutputKeyPrefix: destPath,
      Input: {
        Key: sourcePath
      }, Outputs: [{
        Key: destFile,
        PresetId: Environment.transcodePreset,
        ThumbnailPattern: thumbPattern
      }]
    }

    console.log(params);
    const encoder = this.getEncoder();
    console.log("created encoder")

    const promise: Promise<any> = new Promise((resolve, reject) => {
      encoder.createJob(params, (err, data) => {
        if (err) reject(err);
        else resolve(data);
      });
    });;

    console.log("created promise")

    const result = await promise;
    console.log(JSON.stringify(result));

  }

  static async createWebms(resourceId: string) {
    const items = await Repositories.getCurrent().resource.loadNeedingWebm();
    for (const item of items) {
      const encode = (!resourceId || resourceId === item.id)
      if (encode) await TranscodeHelper.createWebm(item.name, item.contentPath);
    }
  }

  static async createWebm(resourceName: string, mp4Path: string) {
    const webmName = resourceName.toLowerCase()
      .replace(' ', '-')
      .replace(/[^0-9a-z\-]/gi, '')
      .replace('--', '-')
      .replace('--', '-') + ".webm";

    let mp4 = mp4Path.replace(Environment.contentRoot, "");
    mp4 = mp4.split("?")[0];
    mp4 = mp4.substr(1, mp4.length);
    const idx = mp4.lastIndexOf('/');
    const path = mp4.substr(0, idx + 1);

    await TranscodeHelper.encodeWebm(mp4, path, webmName);
  }




}