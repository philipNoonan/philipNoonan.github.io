/*jshint esversion: 6 */

// Copyright 2017 Intel Corporation.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

  class DepthCamera {

    constructor() {
    }

    static async getDepthStream() {
      if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices ||
        !navigator.mediaDevices.getUserMedia) {
        throw new Error("Your browser doesn't support the required mediaDevices APIs.");
      }
      const supported_constraints = navigator.mediaDevices.getSupportedConstraints();
      if (supported_constraints.videoKind) {
        let stream = await navigator.mediaDevices.getUserMedia({
          video: {
            videoKind: {exact: "depth"},
            frameRate: {exact: 60}
          }
        });
        const track = stream.getVideoTracks()[0];
        let settings = track.getSettings ? track.getSettings() : null;
        // TODO: following is a browser bug if happening.
        if (settings.videoKind != "depth")
          throw new Error("No RealSense depth camera connected.");
        return stream;
      }

      const constraints = {
        audio: false,
        video: {
          width: 848,
          height: 480,
          frameRate: {ideal: 90},
        }
      }

      let stream = await navigator.mediaDevices.getUserMedia(constraints);
      let track = stream.getVideoTracks()[0];

      // let sets = track.getSettings();
      // let caps = track.getCapabilities();

      if (track.label.indexOf("RealSense") == -1) {
        throw new Error(chromeVersion() < 58 ?
          "Your browser version is too old. Get Chrome version 58 or later." :
          "No RealSense camera connected.");
      }
      return stream;
    }

    static async getColorStream() {
      if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices ||
        !navigator.mediaDevices.getUserMedia) {
        throw new Error("Your browser doesn't support the required mediaDevices APIs.");
      }
      const supported_constraints = navigator.mediaDevices.getSupportedConstraints();
      if (supported_constraints.videoKind) {
        let stream = await navigator.mediaDevices.getUserMedia({
          video: {
            videoKind: {exact: "video"},
            frameRate: {exact: 30}
          }
        });
        const track = stream.getVideoTracks()[0];
        let settings = track.getSettings ? track.getSettings() : null;
        return stream;
      }

      const constraints = {
        audio: false,
        video: {
          width: 848,
          height: 480,
          frameRate: {ideal: 30},
        }
      }

      let stream = await navigator.mediaDevices.getUserMedia(constraints);
      let track = stream.getVideoTracks()[0];
      // if (track.label.indexOf("RealSense") == -1) {
      //   throw new Error(chromeVersion() < 58 ?
      //     "Your browser version is too old. Get Chrome version 58 or later." :
      //     "No RealSense camera connected.");
      // }
      return stream;
    }

}

function chromeVersion() {
  const raw = navigator.userAgent.match(/Chrom(e|ium)\/([0-9]+)\./);
  return raw ? parseInt(raw[2], 10) : false;
}
