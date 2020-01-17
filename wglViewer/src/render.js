function yawPitchRoll(yaw, pitch, roll) {

  var cosYaw = Math.cos(yaw);
  var sinYaw = Math.sin(yaw);
  var cosPitch = Math.cos(pitch);
  var sinPitch = Math.sin(pitch);
  var cosRoll = Math.cos(roll);
  var sinRoll = Math.sin(roll);

return [
cosYaw * cosPitch,
cosYaw * sinPitch * sinRoll - sinYaw * cosRoll,
cosYaw * sinPitch * cosRoll + sinYaw * sinRoll,
0.0,
sinYaw * cosPitch,
sinYaw * sinPitch * sinRoll + cosYaw * cosRoll,
sinYaw * sinPitch * cosRoll - cosYaw * sinRoll,
0.0,
-sinPitch,
cosPitch * sinRoll,
cosPitch * cosRoll,
0.0,
0.0, 0.0, 0.0, 1.0
];
}

function render(gl) {

gl.orientation[0] += 0.005; // yaw
gl.orientation[1] += 0.005; // pitch
gl.orientation[2] += 0.005; // roll


var yawMatrix = new Float32Array(yawPitchRoll(gl.orientation[0], 0.0, 0.0));
var pitchMatrix = new Float32Array(yawPitchRoll(0.0, gl.orientation[1], 0.0));
var rollMatrix = new Float32Array(yawPitchRoll(0.0, 0.0, gl.orientation[2]));
var yawPitchRollMatrix = new Float32Array(yawPitchRoll(gl.orientation[0], gl.orientation[1], gl.orientation[2]));
var matrices = [yawMatrix, pitchMatrix, rollMatrix, yawPitchRollMatrix];

// Clear color buffer
gl.clearColor(0.0, 0.0, 0.0, 1.0);
gl.clear(gl.COLOR_BUFFER_BIT);
gl.clearDepth(1.0);                 // Clear everything
gl.enable(gl.DEPTH_TEST);           // Enable depth testing
gl.depthFunc(gl.LEQUAL); // Near things obscure far things

// Bind program
gl.useProgram(gl.renderProgram);

gl.uniform1i(gl.getUniformLocation(gl.renderProgram, 'volumeData'), 0);

gl.activeTexture(gl.TEXTURE0);
gl.bindTexture(gl.TEXTURE_3D, gl.textureVolume);

var translate = vec3.create();
vec3.set(translate, 0, 0, -30);
var modelView = mat4.create();
mat4.translate(modelView, modelView, translate);
mat4.rotateX(modelView, modelView, 0.2);



mat4.rotateY(modelView, modelView, gl.orientation[0]);

var perspective = mat4.create();

mat4.perspective(perspective, 45 * Math.PI / 180, gl.canvas.clientWidth / gl.canvas.clientHeight, 1, 100);

var MVP = mat4.create();

mat4.multiply(MVP, perspective, modelView);

gl.bindVertexArray(gl.vertexArray);

// gl.bindBuffer(gl.ARRAY_BUFFER, gl.vertexPosBuffer);
// gl.vertexAttribPointer(gl.vertexPosLocation, 3, gl.FLOAT, false, 0, 0);
// gl.bindBuffer(gl.ARRAY_BUFFER, gl.vertexTexBuffer);
// gl.vertexAttribPointer(gl.vertexTexLocation, 3, gl.FLOAT, false, 0, 0);
// gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, gl.indicesBuffer);

gl.viewport(gl.vp.x, gl.vp.y, gl.vp.z, gl.vp.w);
gl.uniformMatrix4fv(gl.getUniformLocation(gl.renderProgram, 'MV'), false, modelView);
gl.uniformMatrix4fv(gl.getUniformLocation(gl.renderProgram, 'proj'), false, perspective);
gl.uniformMatrix4fv(gl.getUniformLocation(gl.renderProgram, 'orientation'), false, matrices[0]);
gl.drawElements(gl.TRIANGLES, 18, gl.UNSIGNED_SHORT, 0);
////gl.drawElementsInstanced(gl.TRIANGLES, 0, 18, 1);
////gl.drawArrays(gl.TRIANGLES, 0, 18);

gl.bindVertexArray(null);



gl.viewport(gl.vp.x, gl.vp.y, gl.vp.z, gl.vp.w);

gl.useProgram(gl.mcRenderProgram);

gl.bindVertexArray(gl.vaoMarchingCubes);

gl.uniformMatrix4fv(gl.getUniformLocation(gl.mcRenderProgram, 'MVP'), false, MVP);
gl.uniform1f(gl.getUniformLocation(gl.mcRenderProgram, 'MCScaleFactor'), 0.25);
gl.uniform1i(gl.getUniformLocation(gl.mcRenderProgram, 'volumeData'), 0);
gl.activeTexture(gl.TEXTURE0);
gl.bindTexture(gl.TEXTURE_3D, gl.textureHistoPyramid);

gl.drawArrays(gl.TRIANGLES, 0, (gl.totalSumVerts));
//gl.drawArrays(gl.POINTS, 0, (gl.totalSumVerts));




gl.bindVertexArray(null);








}