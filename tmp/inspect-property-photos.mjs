import fs from 'node:fs';
import {createCanvas,loadImage} from '@napi-rs/canvas';
const c=createCanvas(1200,680);const x=c.getContext('2d');x.fillStyle='#faf7f0';x.fillRect(0,0,1200,680);x.font='22px Arial';
for(let i=0;i<8;i++){const im=await loadImage(`tmp/presentation-photos/photo-${i+1}.jpg`);const col=i%4,row=Math.floor(i/4);const scale=Math.min(280/im.width,280/im.height);x.drawImage(im,col*300+10,row*340+10,im.width*scale,im.height*scale);x.fillStyle='#202020';x.fillText(`${i+1} (${im.width}×${im.height})`,col*300+10,row*340+318);}
fs.writeFileSync('tmp/presentation-photos/contact-sheet.png',c.toBuffer('image/png'));
