## What this changes

<!-- One paragraph. -->

## Why

<!-- If this fixes a bug, describe the bug, not just the fix. -->

## Checks

- [ ] `npm run lint`
- [ ] `npx tsc --noEmit`
- [ ] `npm run check:data`
- [ ] `npm test`
- [ ] `npm run build`
- [ ] `npx playwright test`

## If this fixes a runtime bug

- [ ] There is a regression test that fails without the fix

## If this touches the curriculum

- [ ] `node scripts/propose-node.mjs` output is in the linked issue
- [ ] Every new node states what training it will **not** do
- [ ] Evidence bands are honest, including where they are unflattering
- [ ] Every new edge has a mechanism
- [ ] A migration exists for any rename, merge or split
- [ ] There is an RFC issue for structural changes

## If this touches the learner model

- [ ] No new number is shown without its confidence
- [ ] No path was added by which clicking, rather than improving, raises a score
