#!/usr/bin/env node
import fs from 'node:fs'
fs.writeFileSync('files.lock', new Date().toISOString(), 'utf8')
console.log('Locked repository with files.lock')
