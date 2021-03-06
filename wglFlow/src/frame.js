function copyImage(gl, target, source, level, width, height, format) {
  gl.useProgram(copyImageProgram);

  if (format == gl.RGBA8UI)
  {
    gl.uniform1i(gl.getUniformLocation(copyImageProgram, "uinputMap"), 0);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, source);

    gl.uniform1i(gl.getUniformLocation(copyImageProgram, "imageType"), 0);
    gl.bindImageTexture(0, target, level, false, 0, gl.WRITE_ONLY, format);

  }
  else if (format == gl.RGBA32F)
  {
    gl.uniform1i(gl.getUniformLocation(copyImageProgram, "inputMap"), 1);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, source);

    gl.uniform1i(gl.getUniformLocation(copyImageProgram, "imageType"), 1);
    gl.bindImageTexture(1, target, level, false, 0, gl.WRITE_ONLY, format);

  }
  else if (format == gl.R8UI)
  {
    gl.uniform1i(gl.getUniformLocation(copyImageProgram, "inputMap"), 1);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, source);

    gl.uniform1i(gl.getUniformLocation(copyImageProgram, "imageType"), 2);
    gl.bindImageTexture(2, target, level, false, 0, gl.WRITE_ONLY, format);
  }

  gl.dispatchCompute(divup(width >> level, 32), divup(height >> level, 32), 1);
  gl.memoryBarrier(gl.SHADER_IMAGE_ACCESS_BARRIER_BIT);
}

function genMipMap(gl, target, numberOfLevels, width, height, format)
{
  gl.useProgram(genMipMapProgram);

  for (let level = 1; level < numberOfLevels; level++)
  {
    if (format == gl.RGBA8UI)
    {
      gl.uniform1i(gl.getUniformLocation(genMipMapProgram, "imageType"), 0);
      gl.bindImageTexture(0, target, level, false, 0, gl.WRITE_ONLY, format);
      gl.bindImageTexture(1, target, level - 1, false, 0, gl.READ_ONLY, format);
    }
    else if (format == gl.RGBA32F)
    {
      gl.uniform1i(gl.getUniformLocation(genMipMapProgram, "imageType"), 1);
      gl.bindImageTexture(2, target, level, false, 0, gl.WRITE_ONLY, format);
      gl.bindImageTexture(3, target, level - 1, false, 0, gl.READ_ONLY, format);
    }
    else if (format == gl.R8UI)
    {
      gl.uniform1i(gl.getUniformLocation(genMipMapProgram, "imageType"), 2);
      gl.bindImageTexture(4, target, level, false, 0, gl.WRITE_ONLY, format);
      gl.bindImageTexture(5, target, level - 1, false, 0, gl.READ_ONLY, format);
    }
  
    gl.dispatchCompute(divup(width >> level, 8), divup(height >> level, 8), 1);
    gl.memoryBarrier(gl.SHADER_IMAGE_ACCESS_BARRIER_BIT);
  }

}


function checkIfNewImage(gl, lastImage, nextImage)
{
  gl.useProgram(checkIfNewImageProgram);

  gl.uniform1i(gl.getUniformLocation(checkIfNewImageProgram, "lastImage"), 0);
  gl.uniform1i(gl.getUniformLocation(checkIfNewImageProgram, "nextImage"), 1);

  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, gl.lastColor_texture);
  gl.activeTexture(gl.TEXTURE1);
  gl.bindTexture(gl.TEXTURE_2D, gl.color_texture);

  gl.bindBufferBase(gl.SHADER_STORAGE_BUFFER, 0, gl.ssboCheckData);

  gl.dispatchCompute(1, 1, 1);
  gl.memoryBarrier(gl.SHADER_IMAGE_ACCESS_BARRIER_BIT);

  const outputCheckData = new Uint32Array(1);
  gl.bindBuffer(gl.SHADER_STORAGE_BUFFER, gl.ssboCheckData);
  gl.getBufferSubData(gl.SHADER_STORAGE_BUFFER, 0, outputCheckData);
  gl.memoryBarrier(gl.ALL_BARRIER_BITS);

  gl.newImage = outputCheckData < 1 ? 0 : 1;
  //console.log(outputCheckData);

  
}


function calcGradient(gl, level, width, height) {


    gl.useProgram(edgeDetectProgram);

    gl.uniform1i(gl.getUniformLocation(edgeDetectProgram, "colorMap"), 0);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, gl.color_texture);

    //gl.bindImageTexture(0, gl.color_texture, level, false, 0, gl.READ_ONLY, gl.RGBA8UI)
    gl.bindImageTexture(1, gl.gradient_texture, level, false, 0, gl.WRITE_ONLY, gl.RGBA32F)
    gl.bindImageTexture(2, gl.srcTex, level, false, 0, gl.WRITE_ONLY, gl.RGBA32F)

    // bind uniforms
    let lesser = 3.0;
    let upper = 10.0;
    gl.uniform1f(gl.getUniformLocation(edgeDetectProgram, "lesser"), lesser);
    gl.uniform1f(gl.getUniformLocation(edgeDetectProgram, "upper"), upper);
    gl.uniform1i(gl.getUniformLocation(edgeDetectProgram, "level"), level);
    gl.uniform1f(gl.getUniformLocation(edgeDetectProgram, "normVal"), (1.0 / (2.0 * upper + 4.0 * lesser)));

    gl.dispatchCompute(divup(width, 32), divup(height, 32), 1);
    gl.memoryBarrier(gl.SHADER_IMAGE_ACCESS_BARRIER_BIT);

}

function doDFT2D(gl, dir) {
  gl.useProgram(dft2DProgram);

  let w = 640;
  let h = 480;
  let gw = 16;

  if (dir == -1) {
    src = gl.srcTex;
    dst = gl.dstTex;
  }
  else if (dir == 1) {
    src = gl.dstTex;
    dst = gl.srcTex;
  }

  gl.bindImageTexture(0, src, 0, false, 0, gl.READ_ONLY,  gl.RGBA32F);
  gl.bindImageTexture(1, dst, 0, false, 0, gl.WRITE_ONLY, gl.RGBA32F);
  gl.uniform1i(gl.getUniformLocation(dft2DProgram, "hori"), 1);

  gl.dispatchCompute(w / gw, w / gw, 1);
  gl.memoryBarrier(gl.SHADER_IMAGE_ACCESS_BARRIER_BIT);



  gl.bindImageTexture(0, dst, 0, false, 0, gl.READ_ONLY,  gl.RGBA32F);
  gl.bindImageTexture(1, src, 0, false, 0, gl.WRITE_ONLY, gl.RGBA32F);
  gl.uniform1i(gl.getUniformLocation(dft2DProgram, "hori"), 0);

  gl.dispatchCompute(w / gw, w / gw, 1);
  gl.memoryBarrier(gl.SHADER_IMAGE_ACCESS_BARRIER_BIT);

}

function doFFT2D(gl, dir) {
  gl.useProgram(fft2DProgram);

  let w = 640;
  let h = 480;
  let gw = 16;

  //if (dir == 1) {
    src = gl.srcTex;
    dst = gl.dstTex;
  //}
  //else if (dir == -1) {
  //  src = gl.dstTex;
  //  dst = gl.srcTex;
  //}

  let radix = Math.ceil(Math.sqrt(Math.min(h, w)));

  gl.uniform1i(gl.getUniformLocation(fft2DProgram, "radix"), radix);
  gl.uniform1i(gl.getUniformLocation(fft2DProgram, "dir"), dir);


  gl.bindImageTexture(0, src, 0, false, 0, gl.READ_ONLY,  gl.RGBA32F);
  gl.bindImageTexture(1, dst, 0, false, 0, gl.WRITE_ONLY, gl.RGBA32F);
  gl.uniform1i(gl.getUniformLocation(fft2DProgram, "hori"), 1);
  gl.uniform1i(gl.getUniformLocation(fft2DProgram, "pingpong"), 1);

  gl.dispatchCompute(w / gw, w / gw, 1);
  gl.memoryBarrier(gl.SHADER_IMAGE_ACCESS_BARRIER_BIT);

  gl.bindImageTexture(0, dst, 0, false, 0, gl.READ_ONLY,  gl.RGBA32F);
  gl.bindImageTexture(1, src, 0, false, 0, gl.WRITE_ONLY, gl.RGBA32F);
  gl.uniform1i(gl.getUniformLocation(fft2DProgram, "hori"), 1);
  gl.uniform1i(gl.getUniformLocation(fft2DProgram, "pingpong"), 0);

  gl.dispatchCompute(w / gw, w / gw, 1);
  gl.memoryBarrier(gl.SHADER_IMAGE_ACCESS_BARRIER_BIT);

  gl.bindImageTexture(0, src, 0, false, 0, gl.READ_ONLY,  gl.RGBA32F);
  gl.bindImageTexture(1, dst, 0, false, 0, gl.WRITE_ONLY, gl.RGBA32F);
  gl.uniform1i(gl.getUniformLocation(fft2DProgram, "hori"), 0);
  gl.uniform1i(gl.getUniformLocation(fft2DProgram, "pingpong"), 1);

  gl.dispatchCompute(w / gw, w / gw, 1);
  gl.memoryBarrier(gl.SHADER_IMAGE_ACCESS_BARRIER_BIT);

  gl.bindImageTexture(0, dst, 0, false, 0, gl.READ_ONLY,  gl.RGBA32F);
  gl.bindImageTexture(1, src, 0, false, 0, gl.WRITE_ONLY, gl.RGBA32F);
  gl.uniform1i(gl.getUniformLocation(fft2DProgram, "hori"), 0);
  gl.uniform1i(gl.getUniformLocation(fft2DProgram, "pingpong"), 0);

  gl.dispatchCompute(w / gw, w / gw, 1);
  gl.memoryBarrier(gl.SHADER_IMAGE_ACCESS_BARRIER_BIT);

}


function inverseSearch(gl, level, width, height){

  let invDenseSize = [1.0 / (width >> level), 1.0 / (height >> level)];
  let invPrevDenseSize = [1.0 / (width >> (level + 1)), 1.0 / (height >> (level + 1))];  
  let sparseSize = [(width / 4.0) >> level , (height / 4.0) >> level];

  gl.useProgram(disSearchProgram);
  
  gl.uniform1i(gl.getUniformLocation(disSearchProgram, "lastColorMap"), 0);
  gl.uniform1i(gl.getUniformLocation(disSearchProgram, "nextColorMap"), 1);
  gl.uniform1i(gl.getUniformLocation(disSearchProgram, "lastGradientMap"), 2);
  gl.uniform1i(gl.getUniformLocation(disSearchProgram, "flowMap"), 3);
  gl.uniform1i(gl.getUniformLocation(disSearchProgram, "lastFlowMap"), 4);

  gl.uniform1f(gl.getUniformLocation(disSearchProgram, "level"), level);
  gl.uniform2fv(gl.getUniformLocation(disSearchProgram, "invImageSize"), invDenseSize);
  gl.uniform2fv(gl.getUniformLocation(disSearchProgram, "invPreviousImageSize"), invPrevDenseSize);

  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, gl.lastColor_texture);
  gl.activeTexture(gl.TEXTURE1);
  gl.bindTexture(gl.TEXTURE_2D, gl.color_texture);
  gl.activeTexture(gl.TEXTURE2);
  gl.bindTexture(gl.TEXTURE_2D, gl.lastGradient_texture);
  gl.activeTexture(gl.TEXTURE3);
  gl.bindTexture(gl.TEXTURE_2D, gl.densify_texture);
  gl.activeTexture(gl.TEXTURE4);
  gl.bindTexture(gl.TEXTURE_2D, gl.flow_texture);

  //gl.bindImageTexture(0, gl.lastGradient_texture, level, false, 0, gl.READ_ONLY, gl.RGBA16F);
  //gl.bindImageTexture(1, gl.densify_texture, level + 1, false, 0, gl.READ_ONLY, gl.RGBA16F);



  gl.bindImageTexture(2, gl.sparseFlow_texture, level, false, 0, gl.WRITE_ONLY, gl.RGBA32F);
  gl.bindImageTexture(3, gl.densify_texture, level, false, 0, gl.WRITE_ONLY, gl.RGBA32F);

  //gl.bindImageTexture(4, gl.flow_texture, level, false, 0, gl.READ_ONLY, gl.RGBA16F);

  //gl.bindImageTexture(6, gl.lastGrey_texture, level, false, 0, gl.READ_ONLY, gl.R32F);

  //gl.dispatchCompute(divup(width >> level, 32), divup(height >> level, 32), 1);

  gl.dispatchCompute(divup(sparseSize[0], 32), divup(sparseSize[1], 32), 1);
  gl.memoryBarrier(gl.SHADER_IMAGE_ACCESS_BARRIER_BIT);

}

function densify(gl, level, width, height) {
  

  gl.bindVertexArray(gl.vaoDensify);

  let sparseSize = [(width / 4.0) >> level, (height / 4.0) >> level];
  let invDenseSize = [1.0 / (width >> level), 1.0 / (height >> level)];

  gl.bindFramebuffer(gl.FRAMEBUFFER, gl.frameBuffers[level]);

  //let drawBuffs = [gl.COLOR_ATTACHMENT0, gl.COLOR_ATTACHMENT1];
  let drawBuffs = [gl.COLOR_ATTACHMENT0];


  gl.disable(gl.DEPTH_TEST);

  gl.enable(gl.BLEND);
  gl.blendFunc(gl.ONE, gl.ONE);

  gl.viewport(0, 0, width >> level, height >> level);

  gl.useProgram(disDensificationProgram);

  gl.uniform1i(gl.getUniformLocation(disDensificationProgram, "sparseFlowMap"), 1);
  gl.uniform1i(gl.getUniformLocation(disDensificationProgram, "lastImage"), 2);
  gl.uniform1i(gl.getUniformLocation(disDensificationProgram, "nextImage"), 3);


  gl.activeTexture(gl.TEXTURE1);
  gl.bindTexture(gl.TEXTURE_2D, gl.sparseFlow_texture);
  gl.activeTexture(gl.TEXTURE2);
  gl.bindTexture(gl.TEXTURE_2D, gl.lastColor_texture);
  gl.activeTexture(gl.TEXTURE3);
  gl.bindTexture(gl.TEXTURE_2D, gl.color_texture);

  gl.uniform1f(gl.getUniformLocation(disDensificationProgram, "level"), level);
  gl.uniform2fv(gl.getUniformLocation(disDensificationProgram, "invDenseTexSize"), invDenseSize);
  gl.uniform2iv(gl.getUniformLocation(disDensificationProgram, "sparseTexSize"), sparseSize);

  //gl.bindImageTexture(0, gl.sparseFlow_texture, level, false, 0, gl.READ_ONLY, gl.RGBA16F)

  gl.drawBuffers(drawBuffs);

  let numberOfPatches = sparseSize[0] * sparseSize[1];

  gl.bindBuffer(gl.ARRAY_BUFFER, gl.sparsePix_buffer);
  gl.vertexAttribPointer(gl.vertex_location, 2, gl.FLOAT, false, 0, 0);

  gl.drawArrays(gl.POINTS, 0, numberOfPatches);

  gl.bindFramebuffer(gl.FRAMEBUFFER, null);

  //gl.disable(gl.DEPTH_TEST);
  //gl.enable(gl.BLEND);
 // gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

 gl.bindVertexArray(null);

}


function getFlowFromPart(gl, maskTex) {
  gl.useProgram(getFlowFromPartProgram);

  // using body-pix supplied list of ID pixels indicating chest area
  gl.bindImageTexture(0, gl.densify_texture, 0, false, 0, gl.READ_ONLY, gl.RGBA32F);
  gl.bindImageTexture(1, maskTex, 0, false, 0, gl.READ_ONLY, gl.R32F);

  // loop for each person detected?

  gl.bindBufferBase(gl.SHADER_STORAGE_BUFFER, 0, gl.ssboChestFlowData);


  gl.dispatchCompute(16, 1, 1);
  gl.memoryBarrier(gl.SHADER_IMAGE_ACCESS_BARRIER_BIT);



  const outputChestFlowData = new Float32Array(16 * 2);
  gl.bindBuffer(gl.SHADER_STORAGE_BUFFER, gl.ssboChestFlowData);
  gl.getBufferSubData(gl.SHADER_STORAGE_BUFFER, 0, outputChestFlowData);
  gl.memoryBarrier(gl.ALL_BARRIER_BITS);

  let flowX = 0;
  let flowY = 0;
  for (let i = 0; i < 32; i += 2) {
    flowX += outputChestFlowData[i];
    flowY += outputChestFlowData[i + 1];
  }



  return [flowX, flowY];

}

function getFlowFromPoint(gl, point, radius) {
  gl.useProgram(getFlowFromPointProgram);

  gl.bindImageTexture(0, gl.densify_texture, 0, false, 0, gl.READ_ONLY, gl.RGBA32F);

  gl.uniform4fv(gl.getUniformLocation(getFlowFromPointProgram, "inputData"), [point[0], point[1], radius, 0]);

  gl.bindBufferBase(gl.SHADER_STORAGE_BUFFER, 0, gl.ssboChestFlowData);


  gl.dispatchCompute(16, 1, 1);
  gl.memoryBarrier(gl.SHADER_IMAGE_ACCESS_BARRIER_BIT);



  const outputChestFlowData = new Float32Array(16 * 2);
  gl.bindBuffer(gl.SHADER_STORAGE_BUFFER, gl.ssboChestFlowData);
  gl.getBufferSubData(gl.SHADER_STORAGE_BUFFER, 0, outputChestFlowData);
  gl.memoryBarrier(gl.ALL_BARRIER_BITS);

  let flowX = 0;
  let flowY = 0;
  for (let i = 0; i < 32; i += 2) {
    flowX += outputChestFlowData[i];
    flowY += outputChestFlowData[i + 1];
  }



  return [flowX, flowY];


}


function makeMaskFromPoints(gl, w, h, target, point, radius) {
  gl.useProgram(makeMaskFromPointsProgram);

  gl.bindImageTexture(0, target, 0, false, 0, gl.WRITE_ONLY, gl.R32F);

  gl.uniform4fv(gl.getUniformLocation(makeMaskFromPointsProgram, "inputData"), [point[0] * w, point[1] * h, radius, 0]);


  gl.dispatchCompute(divup(w, 32), divup(h, 32), 1);
  gl.memoryBarrier(gl.SHADER_IMAGE_ACCESS_BARRIER_BIT);
}