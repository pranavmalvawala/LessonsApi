import AWS from "aws-sdk";
import { Repositories } from "../repositories/Repositories";
import { File, Variant } from "../models";

export class TranscodeHelper {

  private static getEncoder() {
    const config: AWS.ElasticTranscoder.ClientConfiguration = {
      apiVersion: "2012-09-25",
      region: "us-east-1",
      /*
            credentials:
            {
              accessKeyId: process.env.AWS_ACCESS_KEY_ID,
              secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
            },*/
      // endpoint: process.env.AMAZON_S3_BUCKET
    }
    return new AWS.ElasticTranscoder(config)
  }

  static async encodeWebm(sourcePath: string, destPath: string, destFile: string) {
    const params: AWS.ElasticTranscoder.CreateJobRequest =
    {
      PipelineId: process.env.AWS_TRANSCODER_PIPELINE_ID,
      OutputKeyPrefix: destPath,
      Input: {
        Key: sourcePath
      }, Outputs: [{
        Key: destFile,
        PresetId: process.env.AWS_TRANSCODER_PRESET_ID
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


  static async tmpProcessItem(churchId: string, resourceId: string, resourceName: string, mp4Path: string) {
    const webmName = resourceName.toLowerCase()
      .replace(' ', '-')
      .replace(/[^0-9a-z\-]/gi, '')
      .replace('--', '-')
      .replace('--', '-') + ".webm";
    console.log(webmName);

    let mp4 = mp4Path.replace("https://content.lessons.church", "")
    mp4 = mp4.split("?")[0];
    mp4 = mp4.substr(1, mp4.length);
    const idx = mp4.lastIndexOf('/');
    const path = mp4.substr(0, idx + 1);

    const dateModified = new Date();
    const webmPath = "https://content.lessons.church/" + path + webmName + "?dt=" + dateModified.getTime().toString();

    await TranscodeHelper.encodeWebm(mp4, path, webmName);

    const repo = Repositories.getCurrent();
    let file: File = { churchId, fileName: webmName, contentPath: webmPath, fileType: "video/webm", size: 0, dateModified }
    file = await repo.file.save(file);
    console.log(file);

    const variant: Variant = { churchId, resourceId, fileId: file.id, name: "WEBM", downloadDefault: false, playerDefault: true }
    await repo.variant.save(variant);


  }




}