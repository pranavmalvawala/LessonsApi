import Axios from "axios"
import { Environment } from "./Environment";

export class VimeoHelper {

  private static getAxiosConfig() {
    return { headers: { Authorization: "Bearer " + Environment.vimeoToken } }
  }

  public static async getVideoDetails(videoId: string) {
    const resp = await Axios.get("https://api.vimeo.com/videos/" + videoId, this.getAxiosConfig());
    const result = {
      duration: resp.data.duration,
      download720p: this.getDownloadDetails(resp, "720p"),
      download1080p: this.getDownloadDetails(resp, "1080p"),
      download4k: this.getDownloadDetails(resp, "4k"),
      play720p: this.getFileDetails(resp, "720p"),
      play1080p: this.getFileDetails(resp, "1080p"),
      play4k: this.getFileDetails(resp, "4k")
    }
    return result;
  }

  private static getFileDetails(resp: any, rendition: string) {
    let result = ""
    resp.data.files.forEach((f: any) => {
      if (f.rendition === rendition) result = f.link;
    });
    return result;
  }

  private static getDownloadDetails(resp: any, rendition: string) {
    let result = ""
    resp.data.download.forEach((f: any) => {
      if (f.rendition === rendition) result = f.link;
    });
    return result;
  }

}
