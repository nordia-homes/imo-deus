import {it,expect,vi,afterEach} from 'vitest';
import {startVoiceProgress,voiceProgressText} from '../progress';
import {newJarvisSession} from '../session';
import {VoiceAudio} from '../audio';
afterEach(()=>{vi.useRealTimers();vi.unstubAllGlobals();});
it('starts after five seconds, narrates every ten seconds without repeats and stops before the result',async()=>{
 vi.useFakeTimers();const say=vi.fn(async()=>{}),cancel=vi.fn();const progress=startVoiceProgress(say,cancel);
 await vi.advanceTimersByTimeAsync(4999);expect(say).not.toHaveBeenCalled();
 progress.update('', 'search_properties');await vi.advanceTimersByTimeAsync(1);expect(say).toHaveBeenCalledWith('Caut proprietatea potrivită în portofoliu.');
 await vi.advanceTimersByTimeAsync(10000);expect(say).toHaveBeenCalledTimes(2);
 expect(new Set(say.mock.calls.map(call=>call[0])).size).toBe(2);
 progress.stop();await vi.advanceTimersByTimeAsync(15000);expect(say).toHaveBeenCalledTimes(2);expect(cancel).toHaveBeenCalledOnce();
});
it('does not overlap long playback and ignores narration failures',async()=>{
 vi.useFakeTimers();let done!:()=>void;const say=vi.fn(()=>new Promise<void>(resolve=>{done=resolve;}));const p=startVoiceProgress(say,()=>{});
 await vi.advanceTimersByTimeAsync(24000);expect(say).toHaveBeenCalledOnce();done();await vi.advanceTimersByTimeAsync(1000);expect(say).toHaveBeenCalledTimes(2);p.stop();done();
 const failed=startVoiceProgress(async()=>{throw Error('speech unavailable');},()=>{});await vi.advanceTimersByTimeAsync(6000);failed.stop();
});
it('never speaks untrusted tool descriptions as status',()=>{expect(voiceProgressText('published success token secret')).not.toContain('secret');expect(voiceProgressText('facebook_publication_preflight')).toContain('Verific');});
it('creates a fresh conversation without reading or deleting history',()=>{
 const getItem=vi.fn(),setItem=vi.fn();vi.stubGlobal('localStorage',{getItem,setItem});vi.stubGlobal('window',{dispatchEvent:vi.fn()});vi.stubGlobal('CustomEvent',class{constructor(public type:string,public options:unknown){}});
 const a=newJarvisSession('u','a'),b=newJarvisSession('u','a');expect(a.id).not.toBe(b.id);expect(b.hasHistory).toBe(false);expect(getItem).not.toHaveBeenCalled();expect(setItem).toHaveBeenCalledTimes(2);
});
it('mutes physical microphone tracks without invalidating the captured utterance and allows reactivation',()=>{const audio=new VoiceAudio(vi.fn(),vi.fn(),vi.fn(),vi.fn());const track={enabled:true};audio.stream={getAudioTracks:()=>[track]} as any;audio.epoch=4;audio.setMicMuted(true);expect(track.enabled).toBe(false);expect(audio.epoch).toBe(4);audio.setMicMuted(false);expect(track.enabled).toBe(true);});
