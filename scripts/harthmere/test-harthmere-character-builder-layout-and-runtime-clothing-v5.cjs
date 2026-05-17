#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const root = process.argv[2] || process.cwd();
const wake = fs.readFileSync(path.join(root, 'src/client/components/WakeUpScreen.tsx'), 'utf8');
const runtime = fs.readFileSync(path.join(root, 'src/client/game/renderers/local_dev/harthmere_assets.ts'), 'utf8');
const cval = fs.readFileSync(path.join(root, 'src/client/components/CvalHUD.tsx'), 'utf8');

let ok = true;
function check(label, condition) {
  if (condition) {
    console.log(`OK ${label}`);
  } else {
    ok = false;
    console.error(`FAIL ${label}`);
  }
}

check('builder option cards use left-aligned wrapping pill groups',
  wake.includes('className="harthmere-builder-pill-group flex flex-row flex-wrap justify-start gap-3"') ||
  wake.includes('className="harthmere-builder-pill-group flex flex-row flex-wrap justify-start gap-3"')
);
check('builder selected pills use dark readable text on yellow',
  wake.includes('bg-[#ffd530] text-[#25184b]')
);
check('builder pills use standardized compact padding',
  wake.includes('rounded-full border px-4 py-2 text-sm')
);
check('builder preview uses compact full body component',
  wake.includes('data-harthmere-builder-live-preview="compact-full-body"') &&
  wake.includes('<HarthmereCompactFullBodyPreview')
);
check('legacy large CharacterPreview is removed from builder preview',
  !wake.includes('<CharacterPreview')
);
check('procedural townspersons receive runtime clothing visibility guarantee',
  runtime.includes('addHarthmereRuntimeVisibleClothingGuaranteeV22(')
);
check('procedural townspersons receive outward clothing detail layer',
  runtime.includes('addHarthmereRuntimeOutwardClothingDetailLayerV23(')
);
check('CvalHUD no longer passes unsupported iconStyle prop', !cval.includes('iconStyle='));
check('CvalHUD no longer passes unsupported name prop', !cval.includes('name="cvals"'));

if (!ok) {
  console.error('RESULT: FAIL');
  process.exit(1);
}
console.log('RESULT: PASS');
