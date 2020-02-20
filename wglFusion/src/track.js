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
    gl.memoryBarrier(gl.SHADER_IMAGE_ACCESS_BARRIER_BIT);
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
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_3D, gl.volume_texture);
    gl.bindImageTexture(0, gl.vertex_texture, 0, false, 0, gl.READ_ONLY, gl.RGBA32F);
    gl.bindImageTexture(1, gl.normal_texture, 0, false, 0, gl.READ_ONLY, gl.RGBA32F);
    gl.bindImageTexture(2, gl.refVertex_texture, 0, false, 0, gl.WRITE_ONLY, gl.RGBA32F);
    gl.bindImageTexture(3, gl.render_texture, 0, false, 0, gl.WRITE_ONLY, gl.RGBA8UI);
    gl.uniformMatrix4fv(gl.getUniformLocation(p2vTrackProg, "T"), false, _T);
    gl.uniform1f(gl.getUniformLocation(p2vTrackProg, "volDim"), sliderVolumeLength.value);
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


  function calcPoseP2V(gl) {

    if (resetFlag == 0) {
      generateVertNorms(gl);
      raycastVolume(gl);

      var T = glMatrix.mat4.create();

      T = [...pose];
      var level = 0;

      var A = new Float32Array(36); // 6 * 6
      var b = new Float32Array(6);
      var result = new Float32Array(6);
      var resultPrev = new Float32Array(6);

      var icpData = {AE:0.0, icpCount:0};

      var tracked = false;


      for (let i = 0; i < 2; i++)
      {
        var twistedResult = this._twistMatrix(result);
        let tempT = math.flatten(math.expm(twistedResult));

        var currT = glMatrix.mat4.create();
        
        for (var iter=0; iter<tempT.length; iter++) currT[iter] = tempT[iter];      

        trackP2V(gl, width, height, currT, level);
        reduceP2V(gl);
        getReduction(gl, A, b, icpData);

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

        //this._resultToMatrix(result, delta);
        //glMatrix.mat4.mul(T, delta, T);
      }
      //pose = [...T];


    }
    else {
      this._getClickedPoint();
    }
    integrateVolume(gl, integrateFlag, resetFlag);
  }