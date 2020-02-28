function resultToMatrix(_result, _delta)
{
  // from https://github.com/g-truc/glm/tree/master/glm/gtx/euler_angles.inl
  let c1 = Math.cos(-_result[3]);
  let c2 = Math.cos(-_result[4]);
  let c3 = Math.cos(-_result[5]);
  let s1 = Math.sin(-_result[3]);
  let s2 = Math.sin(-_result[4]);
  let s3 = Math.sin(-_result[5]);
  
  _delta[0] = c2 * c3;
  _delta[1] =-c1 * s3 + s1 * s2 * c3;
  _delta[2] = s1 * s3 + c1 * s2 * c3;
  _delta[3] = 0;
  _delta[4] = c2 * s3;
  _delta[5] = c1 * c3 + s1 * s2 * s3;
  _delta[6] =-s1 * c3 + c1 * s2 * s3;
  _delta[7] = 0;
  _delta[8] =-s2;
  _delta[9] = s1 * c2;
  _delta[10] = c1 * c2;
  _delta[11] = 0;
  _delta[12] = _result[0];
  _delta[13] = _result[1];
  _delta[14] = _result[2];
  _delta[15] = 1;
}

function twistMatrix(_result) {
  let sqrMat = [[0.0, _result[2], _result[1], _result[3]],
             [_result[2], 0.0, _result[0], _result[4]],
             [-_result[1], _result[1], 0.0, _result[5]],
             [0.0, 0.0, 0.0, 0.0]];
  return sqrMat;
}

function twist(xi) {

  var M = [
    [0.0,    xi[2], -xi[1], 0.0], 
    [-xi[2],  0.0,    xi[0], 0.0],
    [xi[1], -xi[0],  0.0,   0.0],
    [xi[3],  xi[4],  xi[5], 0.0]
  ];
  return M;
}

function solve(_A, _b, _result) {
  let A = Array.from(_A);
  let b = Array.from(_b);
  let folded_A = luqr.fold(A, 6);
  let res = Array(6);
  res = luqr.solve(folded_A,b);
  if (res != null)
  {
    for (let i = 0; i < res.length; i++)
    {
      _result[i] = res[i];
    }
  }
}

function getReduction(gl, _A, _b, _icpData) {

    const outputReductionData = new Float32Array(8 * 32);
    gl.bindBuffer(gl.SHADER_STORAGE_BUFFER, gl.ssboReductionOutput);
    gl.getBufferSubData(gl.SHADER_STORAGE_BUFFER, 0, outputReductionData);
    for (let row = 1; row < 8; row++) {
        for (let col = 0; col < 32; col++) {
            outputReductionData[col + 0 * 32] += outputReductionData[col + row * 32];
        }
    }
  /*
  vector b
  | 1 |
  | 2 |
  | 3 |
  | 4 |
  | 5 |
  | 6 |
  and
  matrix a
  | 7  | 8  | 9  | 10 | 11 | 12 |
  | 8  | 13 | 14 | 15 | 16 | 17 |
  | 9  | 14 | 18 | 19 | 20 | 21 |
  | 10 | 15 | 19 | 22 | 23 | 24 |
  | 11 | 16 | 20 | 23 | 25 | 26 |
  | 12 | 17 | 21 | 24 | 26 | 27 |
  AE = sqrt( [0] / [28] )
  count = [28]
  */
    for (let i = 1; i <= 6; i++) {
        _b[i - 1] = outputReductionData[i];
    }
    var shift = 7;
    for (let i = 0; i < 6; ++i) {
        for (let j = i; j < 6; ++j) {
            let value = outputReductionData[shift++];
            _A[j * 6 + i] = _A[i * 6 + j] = value;
        }
    }
    _icpData.AE = Math.sqrt(outputReductionData[0] / outputReductionData[28]);
    _icpData.icpCount = outputReductionData[28];
}

function reduceP2P(gl) {
    gl.useProgram(p2pReduceProg);
    gl.uniform2fv(gl.getUniformLocation(p2pReduceProg, "imSize"), imageSize);
    // buffers
    gl.bindBufferBase(gl.SHADER_STORAGE_BUFFER, 0, gl.ssboReduction);
    gl.bindBufferBase(gl.SHADER_STORAGE_BUFFER, 1, gl.ssboReductionOutput);
    gl.dispatchCompute(8, 1, 1);
    gl.memoryBarrier(gl.SHADER_STORAGE_BARRIER_BIT);
}

function trackP2P(gl, width, height, _T, _level) {
    gl.useProgram(p2pTrackProg);
    let projRef = glMatrix.mat4.create();
    let invPose = glMatrix.mat4.create();
    glMatrix.mat4.invert(invPose, pose);
    glMatrix.mat4.mul(projRef, K, invPose);
    // buffers
    gl.bindBufferBase(gl.SHADER_STORAGE_BUFFER, 0, gl.ssboReduction);
    // uniforms 
    gl.uniformMatrix4fv(gl.getUniformLocation(p2pTrackProg, "T"), false, _T);
    gl.uniformMatrix4fv(gl.getUniformLocation(p2pTrackProg, "view"), false, projRef);
    gl.uniform1f(gl.getUniformLocation(p2pTrackProg, "distThresh"), 0.01);
    gl.uniform1f(gl.getUniformLocation(p2pTrackProg, "normThresh"), 0.9);
    gl.uniform1i(gl.getUniformLocation(p2pTrackProg, "mip"), _level);
    gl.uniform4fv(gl.getUniformLocation(p2pTrackProg, "cam"), camPam);
    // textures
    gl.bindImageTexture(0, gl.vertex_texture, 0, false, 0, gl.READ_ONLY, gl.RGBA32F);
    gl.bindImageTexture(1, gl.normal_texture, 0, false, 0, gl.READ_ONLY, gl.RGBA32F);
    gl.bindImageTexture(2, gl.refVertex_texture, 0, false, 0, gl.READ_ONLY, gl.RGBA32F);
    gl.bindImageTexture(3, gl.refNormal_texture, 0, false, 0, gl.READ_ONLY, gl.RGBA32F);
    gl.bindImageTexture(4, gl.render_texture, 0, false, 0, gl.WRITE_ONLY, gl.RGBA8UI);
    gl.dispatchCompute(width / 32, height / 32, 1);
    gl.memoryBarrier(gl.SHADER_IMAGE_ACCESS_BARRIER_BIT);
}

function reduceP2V(gl) {
    gl.useProgram(p2vReduceProg);
    gl.uniform2fv(gl.getUniformLocation(p2vReduceProg, "imSize"), imageSize);
    // buffers
    gl.bindBufferBase(gl.SHADER_STORAGE_BUFFER, 0, gl.ssboReduction);
    gl.bindBufferBase(gl.SHADER_STORAGE_BUFFER, 1, gl.ssboReductionOutput);
    gl.dispatchCompute(8, 1, 1);
    gl.memoryBarrier(gl.SHADER_IMAGE_ACCESS_BARRIER_BIT);
}

function trackP2V(gl, width, height, _T, _level) {
    gl.useProgram(p2vTrackProg);
    gl.bindBufferBase(gl.SHADER_STORAGE_BUFFER, 0, gl.ssboReduction);

    gl.uniform1i(gl.getUniformLocation(p2vTrackProg, "volumeDataTexture"), 0);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_3D, gl.volume_texture);

    gl.bindImageTexture(0, gl.vertex_texture, 0, false, 0, gl.READ_ONLY, gl.RGBA32F);
    gl.bindImageTexture(1, gl.normal_texture, 0, false, 0, gl.READ_ONLY, gl.RGBA32F);
    gl.bindImageTexture(2, gl.refNormal_texture, 0, false, 0, gl.WRITE_ONLY, gl.RGBA32F);
    gl.bindImageTexture(3, gl.render_texture, 0, false, 0, gl.WRITE_ONLY, gl.RGBA8UI);

    gl.uniformMatrix4fv(gl.getUniformLocation(p2vTrackProg, "T"), false, _T);
    gl.uniform1f(gl.getUniformLocation(p2vTrackProg, "volDim"), volLength);
    gl.uniform1f(gl.getUniformLocation(p2vTrackProg, "volSize"), volSize[0]);
    gl.uniform1i(gl.getUniformLocation(p2vTrackProg, "mip"), _level);
    gl.dispatchCompute(width / 32, height / 32, 1);
    gl.memoryBarrier(gl.SHADER_IMAGE_ACCESS_BARRIER_BIT);
}


function calcPoseP2P(gl, width, height) {

    if (resetFlag == 0) {
      generateVertNorms(gl, width, height);
      raycastVolume(gl, width, height);
      
      var T = glMatrix.mat4.create();

      T = [...pose];
      var level = 0;

      var A = new Float32Array(36); // 6 * 6
      var b = new Float32Array(6);
      var result = new Float32Array(6);
      var icpData = {AE:0.0, icpCount:0};

      // use proper lvls ....
      for (let i = 0; i < 2; i++)
      {
        var delta = glMatrix.mat4.create();
        trackP2P(gl, width, height, T, level);
        reduceP2P(gl);
        getReduction(gl, A, b, icpData);
        solve(A, b, result);
        resultToMatrix(result, delta);

        glMatrix.mat4.mul(T, delta, T);
      }
      pose = [...T];
    }
    else {
      getClickedPoint(gl);
    }
    
    integrateVolume(gl, integrateFlag, resetFlag);
  }



  function calcPoseP2V(gl, width, height) {

    if (resetFlag == 0) {
      generateVertNorms(gl, width, height);


      var T = glMatrix.mat4.clone(pose);
      var level = 0;

      var A = new Float32Array(36); // 6 * 6
      var b = new Float32Array(6);
      var result = new Float32Array(6);
      var resultPrev = new Float32Array(6);

      var icpData = {AE:0.0, icpCount:0};

      var tracked = false;



      for (let i = 0; i < 2; i++)
      {

        var twistedResult = twist(result);
        let tempTmat = math.expm(twistedResult);

        let tempTtemp = glMatrix.mat4.fromValues(tempTmat.get([0,0]), tempTmat.get([0,1]), tempTmat.get([0,2]), tempTmat.get([0,3]),
                                             tempTmat.get([1,0]), tempTmat.get([1,1]), tempTmat.get([1,2]), tempTmat.get([1,3]),
                                             tempTmat.get([2,0]), tempTmat.get([2,1]), tempTmat.get([2,2]), tempTmat.get([2,3]),
                                             tempTmat.get([3,0]), tempTmat.get([3,1]), tempTmat.get([3,2]), tempTmat.get([3,3])
          );
        
          let currT = glMatrix.mat4.create();
          glMatrix.mat4.multiply(currT, tempTtemp, T);    

        trackP2V(gl, width, height, currT, level);
        reduceP2V(gl);
        getReduction(gl, A, b, icpData);

        //console.log(icpData);

        let scaling = 1.0 / (Math.max(...A) > 0.0 ? Math.max(...A) : 1.0);

        for (let iter = 0; iter < 36; iter++) A[iter] *= scaling;
        for (let iter = 0; iter < 6; iter++) b[iter] *= scaling;

        //A = A + (i) <-- need to use some mathjs matrix multiplacation stuff here since A is 6x6

        var deltaResult = new Float32Array(6);

        solve(A, b, deltaResult);
        var change = [0, 0, 0, 0, 0, 0];

        for (let iter = 0; iter < 6; iter++) result[iter] -= deltaResult[iter];
        for (let iter = 0; iter < 6; iter++) change[iter] = result[iter] - deltaResult[iter];

        var Cnorm = math.norm(change);

        resultPrev = result;

        if (Cnorm < 1e-4 && icpData.AE != 0.0) {
          tracked = true;
          break;
        }
        else {
          tracked = false;
        }

        // this._resultToMatrix(result, delta);
        // glMatrix.mat4.mul(T, delta, T);
      }

      let tr = twist(result);
        let trmat = math.expm(tr);

        let temptrmat = glMatrix.mat4.fromValues(
        trmat.get([0,0]), trmat.get([0,1]), trmat.get([0,2]), trmat.get([0,3]),
        trmat.get([1,0]), trmat.get([1,1]), trmat.get([1,2]), trmat.get([1,3]),
        trmat.get([2,0]), trmat.get([2,1]), trmat.get([2,2]), trmat.get([2,3]),
        trmat.get([3,0]), trmat.get([3,1]), trmat.get([3,2]), trmat.get([3,3])
          );

          glMatrix.mat4.multiply(pose, temptrmat, T);


    }
    else {
      getClickedPoint(gl);
    }
    integrateVolume(gl, integrateFlag, resetFlag);
  }




  function genIndexMap(gl, invT) {

    gl.useProgram(indexMapGenProg);

    gl.enable(gl.DEPTH_TEST);

    gl.bindFramebuffer(gl.FRAMEBUFFER, gl.indexMapFBO);
    gl.clearColor(-1.0, -1.0, -1.0, -1.0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    let w = imageSize[0] * 4;
    let h = imageSize[1] * 4;
    gl.viewport(0, 0, w, h);


    gl.uniformMatrix4fv(gl.getUniformLocation(indexMapGenProg, "invT"), false, invT);
    gl.uniformMatrix4fv(gl.getUniformLocation(indexMapGenProg, "P"), false, matP); // calibrated persepective
    gl.uniform2fv(gl.getUniformLocation(indexMapGenProg, "imSize"), imageSize);
    gl.uniform4fv(gl.getUniformLocation(indexMapGenProg, "cam"), camPam);
    gl.uniform1f(gl.getUniformLocation(indexMapGenProg, "maxDepth"), 4.0); // SET ME PROPERLY


    gl.bindBufferBase(gl.SHADER_STORAGE_BUFFER, 0, gl.ssboGlobalMap[gl.buffSwitch]);

    gl.drawArrays(gl.POINTS, 0, gl.mapSize[0]); // this needs to be the number of points in the map
    //gl.drawArrays(gl.POINTS, 0, 848*480);

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);

  }

  function updateGlobalMap(gl, T) {

    let invT = glMatrix.mat4.create();
    glMatrix.mat4.invert(invT, T);

    gl.useProgram(updateGlobalMapProg);
    gl.uniformMatrix4fv(gl.getUniformLocation(updateGlobalMapProg, "T"), false, T);
    gl.uniformMatrix4fv(gl.getUniformLocation(updateGlobalMapProg, "invT"), false, invT);
    gl.uniform1i(gl.getUniformLocation(updateGlobalMapProg, "timestamp"), gl.frameCounter);
    gl.uniform1i(gl.getUniformLocation(updateGlobalMapProg, "firstFrame"), gl.firstFrame);
    gl.uniform1f(gl.getUniformLocation(updateGlobalMapProg, "sigma"), 0.6);
    gl.uniform1f(gl.getUniformLocation(updateGlobalMapProg, "c_stable"), gl.cStable);
    gl.uniformMatrix4fv(gl.getUniformLocation(updateGlobalMapProg, "K"), false, K);
    gl.uniform1ui(gl.getUniformLocation(updateGlobalMapProg, "maxMapSize"), 5000000);


    gl.bindImageTexture(0, gl.indexMap_texture, 0, false, 0, gl.READ_ONLY, gl.R32F);
    gl.bindImageTexture(1, gl.vertex_texture, 0, false, 0, gl.READ_ONLY, gl.RGBA32F);
    gl.bindImageTexture(2, gl.normal_texture, 0, false, 0, gl.READ_ONLY, gl.RGBA32F);
    gl.bindImageTexture(3, gl.color_texture, 0, false, 0, gl.READ_ONLY, gl.RGBA8UI);



    gl.bindBuffer(gl.ATOMIC_COUNTER_BUFFER, gl.atomicGMCounter[gl.buffSwitch]);
    gl.bufferSubData(gl.ATOMIC_COUNTER_BUFFER, 0, gl.mapSize);
    gl.bindBuffer(gl.ATOMIC_COUNTER_BUFFER, null);

    gl.bindBufferBase(gl.ATOMIC_COUNTER_BUFFER, 0, gl.atomicGMCounter[gl.buffSwitch]);
    gl.bindBufferBase(gl.SHADER_STORAGE_BUFFER, 0, gl.ssboGlobalMap[gl.buffSwitch]);

    gl.dispatchCompute(divup(imageSize[0], 32), divup(imageSize[1], 32), 1);
    gl.memoryBarrier(gl.ATOMIC_COUNTER_BARRIER_BIT);




    gl.bindBuffer(gl.ATOMIC_COUNTER_BUFFER, gl.atomicGMCounter[gl.buffSwitch]);
    gl.getBufferSubData(gl.ATOMIC_COUNTER_BUFFER, 0, gl.mapSize);
    gl.bindBuffer(gl.ATOMIC_COUNTER_BUFFER, null);

    console.log(gl.mapSize[0]);

    // gl.bindBuffer(gl.SHADER_STORAGE_BUFFER, gl.ssboGlobalMap[gl.buffSwitch]);
    // gl.getBufferSubData(gl.SHADER_STORAGE_BUFFER, 0, gl.globArr);
    // gl.bindBuffer(gl.SHADER_STORAGE_BUFFER, null);

    

  }

  function removeUnnecessaryPoints(gl) {

    gl.useProgram(removeUnnecessaryPointsProg);

    buffs = [gl.buffSwitch, (gl.buffSwitch + 1) % 2];

    gl.uniform1i(gl.getUniformLocation(removeUnnecessaryPointsProg, "timestamp"), gl.frameCounter);
    gl.uniform1f(gl.getUniformLocation(removeUnnecessaryPointsProg, "c_stable"), gl.cStable);

    gl.bindBuffer(gl.ATOMIC_COUNTER_BUFFER, gl.atomicGMCounter[buffs[1]]);
    let blankData = new Uint32Array(1);
    gl.bufferSubData(gl.ATOMIC_COUNTER_BUFFER, 0, blankData);
    gl.bindBuffer(gl.ATOMIC_COUNTER_BUFFER, null);

    gl.bindBufferBase(gl.ATOMIC_COUNTER_BUFFER, 1, gl.atomicGMCounter[buffs[1]]);

    gl.bindBufferBase(gl.SHADER_STORAGE_BUFFER, 0, gl.ssboGlobalMap[buffs[0]]);
    gl.bindBufferBase(gl.SHADER_STORAGE_BUFFER, 1, gl.ssboGlobalMap[buffs[1]]);

    gl.dispatchCompute(divup(gl.mapSize[0], 400), 1, 1);

    gl.memoryBarrier(gl.ALL_BARRIER_BITS);

    gl.bindBuffer(gl.ATOMIC_COUNTER_BUFFER, gl.atomicGMCounter[buffs[1]]);
    gl.getBufferSubData(gl.ATOMIC_COUNTER_BUFFER, 0, gl.mapSize);
    gl.bindBuffer(gl.ATOMIC_COUNTER_BUFFER, null);

    gl.buffSwitch = buffs[1];
  }

  function genVirtualFrame(gl, invT) {

    gl.useProgram(genVirtualFrameProg);

    gl.bindFramebuffer(gl.FRAMEBUFFER, gl.virtualFrameFBO);
    gl.clearColor(0,0,0,0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.viewport(0, 0, imageSize[0], imageSize[1]);

    gl.bindBufferBase(gl.SHADER_STORAGE_BUFFER, 0, gl.ssboGlobalMap[gl.buffSwitch]);

    gl.uniformMatrix4fv(gl.getUniformLocation(genVirtualFrameProg, "invT"), false, invT);
    gl.uniform4fv(gl.getUniformLocation(genVirtualFrameProg, "cam"), camPam);
    gl.uniform2fv(gl.getUniformLocation(genVirtualFrameProg, "imSize"), imageSize);
    gl.uniform1f(gl.getUniformLocation(genVirtualFrameProg, "maxDepth"), 4.0);
    gl.uniform1f(gl.getUniformLocation(genVirtualFrameProg, "c_stable"), gl.cStable);

    gl.drawArrays(gl.POINTS, 0, gl.mapSize[0]);

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  function calcPoseSplat(gl) {

    generateVertNorms(gl, imageSize[0], imageSize[1]);

    let invPose = glMatrix.mat4.create();
    glMatrix.mat4.invert(invPose, pose);

    genIndexMap(gl, invPose);

    // if (resetFlag == 0) {


      
    //   var T = glMatrix.mat4.create();

    //   T = [...pose];
    //   var level = 0;

    //   var A = new Float32Array(36); // 6 * 6
    //   var b = new Float32Array(6);
    //   var result = new Float32Array(6);
    //   var icpData = {AE:0.0, icpCount:0};

    //   // use proper lvls ....
    //   for (let i = 0; i < 2; i++)
    //   {
    //     var delta = glMatrix.mat4.create();
    //     trackP2P(gl, imageSize[0], imageSize[1], T, level);
    //     reduceP2P(gl);
    //     getReduction(gl, A, b, icpData);
    //     solve(A, b, result);
    //     resultToMatrix(result, delta);

    //     glMatrix.mat4.mul(T, delta, T);
    //   }
    //   pose = [...T];
    // }
    // else {
    //   getClickedPoint(gl);
    // }




    if (integrateFlag) {
      updateGlobalMap(gl, pose); // frameCounter is counting window draws, not realsense frame number
      removeUnnecessaryPoints(gl);
    }


    genVirtualFrame(gl, invPose);

    

  }