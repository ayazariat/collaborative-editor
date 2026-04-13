/**
 * Test Setup Script
 * Verifies that all dependencies are installed correctly
 */

const fs = require('fs')
const path = require('path')

console.log('🔍 Testing Collaborative Editor Setup...\n')

// Check if node_modules exists
const nodeModulesPath = path.join(__dirname, 'node_modules')
if (fs.existsSync(nodeModulesPath)) {
  console.log('✅ node_modules directory exists')
} else {
  console.log('❌ node_modules directory not found')
  process.exit(1)
}

// Check critical dependencies
const criticalDeps = [
  'next',
  'react',
  'react-dom',
  '@tiptap/react',
  '@tiptap/starter-kit',
  '@tiptap/extension-collaboration',
  '@tiptap/extension-collaboration-cursor',
  'yjs',
  'y-websocket',
  '@supabase/supabase-js',
  '@supabase/auth-helpers-nextjs',
  'tailwindcss',
  'typescript'
]

console.log('\n📦 Checking critical dependencies:')
let allDepsInstalled = true

criticalDeps.forEach(dep => {
  const depPath = path.join(nodeModulesPath, dep)
  if (fs.existsSync(depPath)) {
    console.log(`  ✅ ${dep}`)
  } else {
    console.log(`  ❌ ${dep} - NOT FOUND`)
    allDepsInstalled = false
  }
})

if (!allDepsInstalled) {
  console.log('\n❌ Some dependencies are missing. Run: npm install')
  process.exit(1)
}

// Check project structure
console.log('\n📁 Checking project structure:')
const requiredFiles = [
  'src/app/page.tsx',
  'src/app/editor/[id]/page.tsx',
  'src/components/Editor.tsx',
  'src/components/Presence.tsx',
  'src/components/Comments.tsx',
  'src/components/VersionHistory.tsx',
  'src/components/ShareModal.tsx',
  'src/lib/supabase.ts',
  'server/websocket.js',
  'supabase-schema.sql',
  'README.md'
]

let allFilesExist = true
requiredFiles.forEach(file => {
  const filePath = path.join(__dirname, file)
  if (fs.existsSync(filePath)) {
    console.log(`  ✅ ${file}`)
  } else {
    console.log(`  ❌ ${file} - NOT FOUND`)
    allFilesExist = false
  }
})

if (!allFilesExist) {
  console.log('\n❌ Some required files are missing')
  process.exit(1)
}

console.log('\n✅ All checks passed!')
console.log('\n📋 Next steps:')
console.log('1. Create .env.local with your Supabase credentials')
console.log('2. Run the SQL schema in Supabase SQL Editor')
console.log('3. Start WebSocket server: npm run ws-server')
console.log('4. Start Next.js: npm run dev')
console.log('5. Open http://localhost:3000')
console.log('\n📚 See README.md for detailed instructions')
