import { expect,it } from 'vitest';
import { executionScope,scopedCreationKey } from '../execution-scope';
import type { AssistantAction } from '../contracts';
const action:AssistantAction={kind:'create_contact',name:'Matei Alin',phone:'0712345678'};
it('inherits only an explicitly supplied valid scope and separates independent requests',()=>{
 const root=executionScope('s','first');expect(executionScope('s','next',root)).toBe(root);
 expect(executionScope('s','next')).not.toBe(root);expect(executionScope('s','next','invalid')).toBe(executionScope('s','next'));
});
it('reuses an exact creation despite reordering while retaining intentional duplicate occurrences',()=>{
 const scope=executionScope('s','first'),seen=new Map<string,number>();
 const first=scopedCreationKey(scope,action,seen),second=scopedCreationKey(scope,action,seen);
 expect(first).not.toBe(second);expect(scopedCreationKey(scope,action,new Map())).toBe(first);
 expect(scopedCreationKey(scope,{...action,name:'Alin Matei'},new Map())).not.toBe(first);
 expect(scopedCreationKey(executionScope('s','another'),action,new Map())).not.toBe(first);
 expect(scopedCreationKey(scope,{kind:'delete_task',taskId:'t'},new Map())).toBeUndefined();
});
