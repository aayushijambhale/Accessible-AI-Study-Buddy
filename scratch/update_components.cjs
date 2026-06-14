const fs = require('fs');
const path = require('path');

const componentsDir = path.join(__dirname, '../src/components');

function replaceInFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf-8');

  // Replace common dashboard widget classes with our new card-soft
  content = content.replace(/bg-white p-6 rounded-2xl border border-\[#0F766E\]\/10 cursor-pointer hover:border-\[#0F766E\]\/40 transition-all shadow-xs/g, 'card-soft p-6 cursor-pointer');
  content = content.replace(/bg-white p-6 rounded-3xl border border-\[#0F766E\]\/10/g, 'card-soft p-6 rounded-3xl');
  content = content.replace(/bg-white rounded-3xl shadow-sm border border-\[#0F766E\]\/10/g, 'card-soft rounded-3xl');
  content = content.replace(/bg-white rounded-3xl shadow-xs border border-teal-100/g, 'card-soft rounded-3xl');
  content = content.replace(/bg-white p-6 rounded-2xl shadow-xs border border-teal-100/g, 'card-soft p-6');
  
  // Make inputs softer
  content = content.replace(/rounded-xl border border-teal-200/g, 'rounded-[18px] border border-teal-200');
  content = content.replace(/rounded-2xl border border-teal-200/g, 'rounded-[24px] border border-teal-200');

  // Inject standard focus states for accessibility (Phase 5 Keyboard Nav & Focus States)
  // We'll globally inject focus-visible ring classes to button and inputs that might be missing them
  content = content.replace(/className="(.*?)cursor-pointer(.*?)"/g, 'className="$1cursor-pointer focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-teal-500$2"');
  content = content.replace(/className="(.*?)hover:bg-(.*?)"/g, 'className="$1hover:bg-$2 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-teal-500"');

  fs.writeFileSync(filePath, content, 'utf-8');
}

const files = fs.readdirSync(componentsDir);
files.forEach(file => {
  if (file.endsWith('.tsx')) {
    replaceInFile(path.join(componentsDir, file));
  }
});

console.log("Applied UI & A11y global replacements.");
