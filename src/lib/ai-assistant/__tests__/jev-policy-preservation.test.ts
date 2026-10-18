import { it, expect } from 'vitest';
import fs from 'node:fs';
import ts from 'typescript';
import baseline from '../../../../docs/jarvis/evals/JEV_POLICY_BASELINE.json';
import { requestReservation } from '../budget';
const printer = ts.createPrinter();
const normalize = (text: string) => { const file = ts.createSourceFile('expr.ts', '(' + text + ')', ts.ScriptTarget.Latest, true); return printer.printFile(file); };
it('preserves every original policy expression and its explicit classification', () => {
    const source = ts.createSourceFile('policy.ts', fs.readFileSync('src/lib/ai-assistant/policy.ts', 'utf8'), ts.ScriptTarget.Latest, true), found = new Map<string, {
        modules: string[];
        expression: string;
    }>();
    function walk(node: ts.Node) { if (ts.isCallExpression(node) && node.expression.getText(source) === 'policyBlock') {
        const [id, modules, expr] = node.arguments;
        found.set(JSON.parse(id.getText(source)), { modules: JSON.parse(modules.getText(source)), expression: expr.getText(source) });
    } ts.forEachChild(node, walk); }
    walk(source);
    expect(found.size).toBe(baseline.blocks.length);
    for (const block of baseline.blocks) {
        const current = found.get(block.id)!;
        expect(current.modules, block.id).toEqual(block.modules);
        expect(normalize(current.expression), block.id).toBe(normalize(block.expression));
    }
});
it('invalidates provider-derived reservations when instructions or schemas change', () => {
    const first = requestReservation('same', [], [{ name: 'a' }]);
    const previous = { plainBytes: first.plainBytes, inputTokens: 2, outputTokens: 1, fingerprint: first.fingerprint };
    expect(requestReservation('same', [], [{ name: 'a' }], previous).tokens).toBe(4);
    const changed = requestReservation('changed', [], [{ name: 'b' }], previous);
    expect(changed.tokens).toBe(changed.plainBytes);
});

it('preserves shared policy text bindings referenced by the original rule blocks',()=>{
 const source=ts.createSourceFile('policy.ts',fs.readFileSync('src/lib/ai-assistant/policy.ts','utf8'),ts.ScriptTarget.Latest,true),found=new Map<string,string>();
 function walk(node:ts.Node){if(ts.isVariableDeclaration(node)&&node.initializer)found.set(node.name.getText(source),node.initializer.getText(source));ts.forEachChild(node,walk);}walk(source);
 for(const binding of baseline.bindings)expect(normalize(found.get(binding.name)!)).toBe(normalize(binding.expression));
});
