  function uploadGraphPoints(gl, _x, _y, _z) {

    gl.useProgram(plottingBufferProg);

    let scaledX = normalize(_x, initPose[12]+0.1, initPose[12]-0.1);
    let scaledY = normalize(_y, initPose[13]+0.1, initPose[13]-0.1);
    let scaledZ = normalize(_z, initPose[14]+0.1, initPose[14]-0.1);

    gl.uniform4fv(gl.getUniformLocation(plottingBufferProg, "newData"), [scaledX, scaledY, scaledZ, 0.0]);
    gl.uniform1i(gl.getUniformLocation(plottingBufferProg, "pingPong"), frameCounter % 2);

    gl.bindBufferBase(gl.SHADER_STORAGE_BUFFER, 0, gl.ssboGraphX);
    gl.bindBufferBase(gl.SHADER_STORAGE_BUFFER, 1, gl.ssboGraphY);
    gl.bindBufferBase(gl.SHADER_STORAGE_BUFFER, 2, gl.ssboGraphZ);

    gl.dispatchCompute(1, 1, 1);
    gl.memoryBarrier(gl.SHADER_IMAGE_ACCESS_BARRIER_BIT);

  }

function render(gl, width, height) {

    gl.viewport(0, 0, width, 240);

    gl.useProgram(plottingRenderProgram);
    gl.bindVertexArray(gl.vaoPlotting);

    gl.uniform2fv(gl.getUniformLocation(plottingRenderProgram, "imageSize"), [1024.0, 240.0]);

    gl.uniform1i(gl.getUniformLocation(plottingRenderProgram, "axis"), 0);
    gl.drawArrays(gl.POINTS, 0, 1024);     

    gl.uniform1i(gl.getUniformLocation(plottingRenderProgram, "axis"), 1);
    gl.drawArrays(gl.POINTS, 0, 1024);

    gl.uniform1i(gl.getUniformLocation(plottingRenderProgram, "axis"), 2);
    gl.drawArrays(gl.POINTS, 0, 1024);
    gl.bindVertexArray(null);

    gl.viewport(0, 240, width / 2.0, height - 240);

	gl.useProgram(renderProgram);
    gl.bindVertexArray(gl.vaoRender);

    let renderOpts = renderDepthFlag << 0 | 
        renderColorFlag << 1 |
        renderRefNormFlag << 2 |
        renderRefVertFlag << 3 |
        renderNormFlag << 4 |
        renderVertFlag << 5;

    gl.uniform1i(gl.getUniformLocation(renderProgram, "renderOptions"), renderOpts);
    gl.uniform2fv(gl.getUniformLocation(renderProgram, "imageSize"), imageSize);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, gl.depth_texture);
    gl.bindImageTexture(0, gl.color_texture, 0, false, 0, gl.READ_ONLY, gl.RGBA8UI);
    gl.bindImageTexture(1, gl.refNormal_texture, 0, false, 0, gl.READ_ONLY, gl.RGBA32F);
    gl.bindImageTexture(2, gl.refVertex_texture, 0, false, 0, gl.READ_ONLY, gl.RGBA32F);
    gl.bindImageTexture(3, gl.normal_texture, 0, false, 0, gl.READ_ONLY, gl.RGBA32F);
    gl.bindImageTexture(4, gl.vertex_texture, 0, false, 0, gl.READ_ONLY, gl.RGBA32F);

    gl.bindBuffer(gl.ARRAY_BUFFER, gl.vertex_buffer);
    gl.vertexAttribPointer(gl.vertex_location, 2, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, gl.index_buffer);
    gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);

    gl.viewport(width / 2.0, 240, width / 2.0, height - 240);

    renderOpts = 0 << 0 | 
                       0 << 1 |
                       1 << 2 |
                       0 << 3 |
                       0 << 4 |
                       0 << 5;

    gl.uniform1i(gl.getUniformLocation(renderProgram, "renderOptions"), renderOpts);
    gl.uniform2fv(gl.getUniformLocation(renderProgram, "imageSize"), imageSize);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, gl.depth_texture);
    gl.bindImageTexture(0, gl.color_texture, 0, false, 0, gl.READ_ONLY, gl.RGBA8UI);
    gl.bindImageTexture(1, gl.refNormal_texture, 0, false, 0, gl.READ_ONLY, gl.RGBA32F)
    gl.bindImageTexture(2, gl.refVertex_texture, 0, false, 0, gl.READ_ONLY, gl.RGBA32F)
    gl.bindImageTexture(3, gl.normal_texture, 0, false, 0, gl.READ_ONLY, gl.RGBA32F)
    gl.bindImageTexture(4, gl.vertex_texture, 0, false, 0, gl.READ_ONLY, gl.RGBA32F)

    gl.bindBuffer(gl.ARRAY_BUFFER, gl.vertex_buffer);
    gl.vertexAttribPointer(gl.vertex_location, 2, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, gl.index_buffer);
    gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);

    gl.bindVertexArray(null);

}