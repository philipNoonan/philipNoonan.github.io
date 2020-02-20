function integrateVolume(gl, _iFlag, _rFlag) {

    gl.useProgram(integrateProg);

    let invPose = glMatrix.mat4.create();
    glMatrix.mat4.invert(invPose, pose);

    gl.uniform4fv(gl.getUniformLocation(integrateProg, "cam"), camPam);
    gl.uniformMatrix4fv(gl.getUniformLocation(integrateProg, "invT"), false, invPose);

    gl.uniform1i(gl.getUniformLocation(integrateProg, "integrateFlag"), _iFlag);
    gl.uniform1i(gl.getUniformLocation(integrateProg, "resetFlag"), _rFlag);

    gl.uniform1i(gl.getUniformLocation(integrateProg, "p2p"), 1);
    gl.uniform1i(gl.getUniformLocation(integrateProg, "p2v"), 0);

    gl.uniform1f(gl.getUniformLocation(integrateProg, "maxWeight"), 100.0);
    gl.uniform1f(gl.getUniformLocation(integrateProg, "volDim"), volLength);
    gl.uniform1f(gl.getUniformLocation(integrateProg, "volSize"), volSize[0]);


    // textures
    gl.bindImageTexture(0, gl.volume_texture, 0, false, 0, gl.READ_WRITE, gl.R32F);
    gl.bindImageTexture(1, gl.volumeWeight_texture, 0, false, 0, gl.READ_WRITE, gl.R32F);

    gl.bindImageTexture(2, gl.vertex_texture, 0, false, 0, gl.READ_ONLY, gl.RGBA32F);
    gl.bindImageTexture(3, gl.render_texture, 0, false, 0, gl.READ_ONLY, gl.RGBA8UI);
    gl.bindImageTexture(4, gl.normal_texture, 0, false, 0, gl.WRITE_ONLY, gl.RGBA32F);

    gl.dispatchCompute(volSize[0] / 32, volSize[1] / 32, 1);
    gl.memoryBarrier(gl.SHADER_IMAGE_ACCESS_BARRIER_BIT);

    if (resetFlag == 1)
    {
      resetFlag = 0;
      integrateFlag = 1;
    }

}

function raycastVolume(gl, width, height) {

    gl.useProgram(raycastProg);

    gl.bindImageTexture(0, gl.volume_texture, 0, false, 0, gl.READ_ONLY, gl.R32F);
    gl.bindImageTexture(1, gl.refVertex_texture, 0, false, 0, gl.WRITE_ONLY, gl.RGBA32F);
    gl.bindImageTexture(2, gl.refNormal_texture, 0, false, 0, gl.WRITE_ONLY, gl.RGBA32F);
    
    let view = glMatrix.mat4.create();
    glMatrix.mat4.mul(view, pose, invK);

    let dMin = -volLength / 20.0;
    let dMax = volLength / 10.0;

    let step = volLength / volSize[0];

    gl.uniformMatrix4fv(gl.getUniformLocation(raycastProg, "view"), false, view);
    gl.uniform1f(gl.getUniformLocation(raycastProg, "step"), step);
    gl.uniform1f(gl.getUniformLocation(raycastProg, "largeStep"), 0.5 * 0.75);
    gl.uniform1f(gl.getUniformLocation(raycastProg, "nearPlane"), 0.01);
    gl.uniform1f(gl.getUniformLocation(raycastProg, "farPlane"), 3.0);
    gl.uniform1f(gl.getUniformLocation(raycastProg, "volDim"), volLength);
    gl.uniform1f(gl.getUniformLocation(raycastProg, "volSize"), volSize[0]);

    gl.dispatchCompute(width / 32, height / 32, 1);
    gl.memoryBarrier(gl.SHADER_IMAGE_ACCESS_BARRIER_BIT);

}

