// Packaged with the voice shell; no public-file fetch or external script service.
export const PCM_WORKLET = `class JarvisPCM extends AudioWorkletProcessor {
 constructor(){super();this.samples=new Float32Array(1024);this.position=0;}
 process(inputs,outputs){const input=inputs[0]?.[0];if(input)for(const value of input){this.samples[this.position++]=value;if(this.position===1024){this.port.postMessage(this.samples,[this.samples.buffer]);this.samples=new Float32Array(1024);this.position=0;}}for(const output of outputs)for(const channel of output)channel.fill(0);return true;}
}
registerProcessor('jarvis-pcm',JarvisPCM);`;
