function getClickedPoint(gl) {

  resetVol(gl);

  gl.useProgram(clickedPointProg);

  gl.uniform2fv(gl.getUniformLocation(clickedPointProg, "clickedPoint"), mouseClickPos);
  gl.bindImageTexture(0, gl.vertex_texture, 0, false, 0, gl.READ_ONLY, gl.RGBA32F);
  gl.bindBufferBase(gl.SHADER_STORAGE_BUFFER, 0, gl.ssboClickedPoint);

  gl.dispatchCompute(1, 1, 1);
  gl.memoryBarrier(gl.SHADER_IMAGE_ACCESS_BARRIER_BIT);

  const clickedVert = new Float32Array(4);

  gl.bindBuffer(gl.SHADER_STORAGE_BUFFER, gl.ssboClickedPoint);
  gl.getBufferSubData(gl.SHADER_STORAGE_BUFFER, 0, clickedVert);

  initPose = glMatrix.mat4.create();
  glMatrix.mat4.translate(initPose, initPose, [-clickedVert[0] + volLength / 2.0, -clickedVert[1] + volLength / 2.0, -clickedVert[2] + volLength / 2.0]);
  pose = [...initPose];

}

function alignDepthColor(gl) {
  gl.useProgram(alignDepthColorProg);

  gl.bindImageTexture(3, gl.mappingC2D_texture, 0, false, 0, gl.WRITE_ONLY, gl.RGBA16UI)
  gl.bindImageTexture(4, gl.mappingD2C_texture, 0, false, 0, gl.WRITE_ONLY, gl.RGBA16UI)

  gl.uniform1i(gl.getUniformLocation(alignDepthColorProg, "functionID"), 0);

  gl.dispatchCompute(divup(imageSize[0], 32), divup(imageSize[1], 32), 1);
  gl.memoryBarrier(gl.ALL_BARRIER_BITS);




  gl.bindImageTexture(0, gl.vertex_texture, 0, false, 0, gl.READ_ONLY, gl.RGBA32F)
  gl.bindImageTexture(1, gl.color_texture, 0, false, 0, gl.READ_ONLY, gl.RGBA8UI)
  gl.bindImageTexture(2, gl.colorAligned_texture, 0, false, 0, gl.WRITE_ONLY, gl.RGBA8UI)
  gl.bindImageTexture(3, gl.mappingC2D_texture, 0, false, 0, gl.WRITE_ONLY, gl.RGBA16UI)
  gl.bindImageTexture(4, gl.mappingD2C_texture, 0, false, 0, gl.WRITE_ONLY, gl.RGBA16UI)

  gl.uniformMatrix4fv(gl.getUniformLocation(alignDepthColorProg, "d2c"), false, depthToColor);
  gl.uniform4fv(gl.getUniformLocation(alignDepthColorProg, "cam"), colorCamPam);
  gl.uniform1i(gl.getUniformLocation(alignDepthColorProg, "functionID"), 1);

  gl.dispatchCompute(divup(imageSize[0], 32), divup(imageSize[1], 32), 1);
  gl.memoryBarrier(gl.ALL_BARRIER_BITS);
}

function generateVertNorms(gl, width, height) {

    gl.useProgram(depthToVertProg);
    gl.bindImageTexture(0, gl.depth_texture, 0, false, 0, gl.READ_ONLY, gl.R32F)
    gl.bindImageTexture(1, gl.vertex_texture, 0, false, 0, gl.WRITE_ONLY, gl.RGBA32F)

    // bind uniforms
    gl.uniformMatrix4fv(gl.getUniformLocation(depthToVertProg, "invK"), false, invK);
    gl.uniform1f(gl.getUniformLocation(depthToVertProg, "minDepth"), 0.1);
    gl.uniform1f(gl.getUniformLocation(depthToVertProg, "maxDepth"), 3.0);
    gl.uniform2fv(gl.getUniformLocation(depthToVertProg, "bottomLeft"), [0, 0]);
    gl.uniform2fv(gl.getUniformLocation(depthToVertProg, "topRight"), imageSize);

    gl.dispatchCompute(divup(width, 32), divup(height, 32), 1);
    gl.memoryBarrier(gl.ALL_BARRIER_BITS);


    gl.useProgram(vertToNormProg);
    gl.bindImageTexture(0, gl.vertex_texture, 0, false, 0, gl.READ_ONLY, gl.RGBA32F)
    gl.bindImageTexture(1, gl.normal_texture, 0, false, 0, gl.WRITE_ONLY, gl.RGBA32F)

    gl.dispatchCompute(divup(width, 32), divup(height, 32), 1);
    gl.memoryBarrier(gl.ALL_BARRIER_BITS);

  }