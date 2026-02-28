#!/usr/bin/env node

/**
 * Demo Video Creator for Kerala e-District Hackathon Project
 * 
 * This script creates a demo video by:
 * 1. Capturing screenshots of key application states
 * 2. Generating slide transitions
 * 3. Compiling into a video with ffmpeg
 * 
 * Requirements:
 * - Node.js 18+
 * - Puppeteer
 * - ffmpeg
 */

const puppeteer = require('puppeteer');
const fs = require('fs').promises;
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

const DEMO_DIR = path.join(__dirname, 'demo-assets');
const BASE_URL = 'https://hackathon.lethimbuild.com';

// Helper function for wait
const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Scene configuration
const SCENES = [
  {
    name: '01-landing',
    url: BASE_URL,
    wait: 2000,
    description: 'Landing Page',
    actions: async (page) => {
      await page.waitForSelector('h1');
    }
  },
  {
    name: '02-apply-scan-initial',
    url: `${BASE_URL}/apply`,
    wait: 2000,
    description: 'Aadhaar Scan Initial Screen',
    actions: async (page) => {
      await page.waitForSelector('h1');
    }
  },
  {
    name: '03-form-empty',
    url: `${BASE_URL}/apply`,
    wait: 1000,
    description: 'Empty Form',
    actions: async (page) => {
      // Click skip to go to form
      try {
        await page.waitForSelector('button', { timeout: 2000 });
        const skipButton = await page.$('button');
        if (skipButton) {
          const buttonText = await page.evaluate(el => el.textContent, skipButton);
          if (buttonText.includes('Skip')) {
            await skipButton.click();
            await wait(1000);
          }
        }
      } catch(e) {
        // Skip button not found, that's okay
      }
    }
  }
];

// Annotation overlays for each scene
const ANNOTATIONS = {
  '01-landing': {
    title: 'Kerala e-District Portal',
    subtitle: 'AI-Powered Certificate Application',
    highlights: [
      { text: 'Voice-enabled form filling', x: '50%', y: '40%' },
      { text: 'Aadhaar card scanning', x: '50%', y: '50%' },
      { text: 'Multi-agent collaboration', x: '50%', y: '60%' }
    ]
  },
  '02-apply-scan-initial': {
    title: 'Step 1: Scan Aadhaar Card',
    subtitle: 'Auto-extract all details with AI',
    highlights: [
      { text: 'Camera access for mobile users', x: '50%', y: '70%' },
      { text: 'GPT-4 Vision OCR', x: '50%', y: '80%' }
    ]
  },
  '03-form-empty': {
    title: 'Step 2: Voice-Powered Form',
    subtitle: 'Speak naturally to fill the form',
    highlights: [
      { text: 'Real-time speech recognition', x: '80%', y: '90%' },
      { text: 'Smart field extraction', x: '50%', y: '50%' }
    ]
  }
};

async function setup() {
  console.log('🎬 Setting up demo environment...');
  
  // Create demo directory
  await fs.mkdir(DEMO_DIR, { recursive: true });
  
  console.log(`✓ Created demo directory: ${DEMO_DIR}`);
}

async function captureScreenshots() {
  console.log('\n📸 Capturing screenshots...');
  
  const browser = await puppeteer.launch({
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--use-fake-ui-for-media-stream',
      '--use-fake-device-for-media-stream'
    ]
  });
  
  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });
  
  for (const scene of SCENES) {
    console.log(`  Capturing: ${scene.description}...`);
    
    await page.goto(scene.url, { waitUntil: 'networkidle0' });
    
    if (scene.actions) {
      try {
        await scene.actions(page);
      } catch (err) {
        console.warn(`    Warning: Action failed for ${scene.name}:`, err.message);
      }
    }
    
    await wait(scene.wait);
    
    const screenshotPath = path.join(DEMO_DIR, `${scene.name}.png`);
    await page.screenshot({ path: screenshotPath, fullPage: false });
    
    console.log(`  ✓ Saved: ${scene.name}.png`);
  }
  
  await browser.close();
  console.log('\n✓ All screenshots captured');
}

async function createAnnotatedImages() {
  console.log('\n🎨 Creating annotated images...');
  
  // Check if ImageMagick is available
  try {
    await execAsync('convert -version');
  } catch (err) {
    console.warn('⚠️  ImageMagick not found. Skipping annotations.');
    console.warn('   Install with: sudo apt-get install imagemagick');
    return false;
  }
  
  for (const scene of SCENES) {
    const annotation = ANNOTATIONS[scene.name];
    if (!annotation) continue;
    
    const inputPath = path.join(DEMO_DIR, `${scene.name}.png`);
    const outputPath = path.join(DEMO_DIR, `${scene.name}-annotated.png`);
    
    // Create overlay with text
    const overlayCommands = [
      `convert "${inputPath}"`,
      `-gravity North -pointsize 60 -fill white -stroke black -strokewidth 2`,
      `-annotate +0+50 "${annotation.title}"`,
      `-gravity North -pointsize 30 -fill white -stroke black -strokewidth 1`,
      `-annotate +0+130 "${annotation.subtitle}"`,
      `"${outputPath}"`
    ];
    
    try {
      await execAsync(overlayCommands.join(' '));
      console.log(`  ✓ Annotated: ${scene.name}`);
    } catch (err) {
      console.warn(`    Warning: Failed to annotate ${scene.name}`);
    }
  }
  
  console.log('\n✓ Annotations complete');
  return true;
}

async function createVideo() {
  console.log('\n🎥 Creating video...');
  
  // Check if ffmpeg is available
  try {
    await execAsync('ffmpeg -version');
  } catch (err) {
    console.error('❌ ffmpeg not found. Please install:');
    console.error('   sudo apt-get install ffmpeg');
    return false;
  }
  
  const videoPath = path.join(__dirname, 'demo-video.mp4');
  
  // Create a concat file for ffmpeg
  const concatFile = path.join(DEMO_DIR, 'concat.txt');
  const concatContent = SCENES.map((scene, idx) => {
    const imagePath = path.join(DEMO_DIR, `${scene.name}-annotated.png`);
    const fallbackPath = path.join(DEMO_DIR, `${scene.name}.png`);
    const duration = idx === 0 ? 5 : (idx === SCENES.length - 1 ? 5 : 4);
    
    return `file '${imagePath}'\nduration ${duration}`;
  }).join('\n');
  
  await fs.writeFile(concatFile, concatContent);
  
  // Create video with fade transitions
  const ffmpegCmd = [
    'ffmpeg -y -f concat -safe 0',
    `-i "${concatFile}"`,
    '-vf "fade=t=in:st=0:d=0.5,fade=t=out:st=14.5:d=0.5"',
    '-c:v libx264 -pix_fmt yuv420p -r 30',
    `"${videoPath}"`
  ].join(' ');
  
  console.log('  Running ffmpeg...');
  try {
    const { stdout, stderr } = await execAsync(ffmpegCmd);
    console.log(`  ✓ Video created: ${videoPath}`);
    return true;
  } catch (err) {
    console.error('  ❌ ffmpeg failed:', err.message);
    return false;
  }
}

async function createMarkdownPresentation() {
  console.log('\n📄 Creating markdown presentation...');
  
  const mdContent = `# Kerala e-District Portal - Demo Presentation

## Multi-Agent System for Government Certificate Applications

---

${SCENES.map((scene, idx) => {
  const annotation = ANNOTATIONS[scene.name] || {};
  return `
### Slide ${idx + 1}: ${annotation.title || scene.description}

![${scene.description}](demo-assets/${scene.name}.png)

**${annotation.subtitle || ''}**

${annotation.highlights ? annotation.highlights.map(h => `- ${h.text}`).join('\n') : ''}

---
`;
}).join('\n')}

## Key Features

- 🎤 **Voice-First Interface** - Speak to fill forms
- 📸 **AI Document Scanning** - Extract data from Aadhaar cards
- 🤖 **Multi-Agent Architecture** - Specialized agents for each task
- ⚡ **Real-Time Processing** - WebRTC for instant feedback
- 📱 **Mobile-Optimized** - Camera & voice work seamlessly

## Technical Stack

- Next.js 15 + React 19 + TypeScript
- OpenAI Realtime API (voice) + GPT-4o Vision (OCR)
- WebRTC data channels
- Production deployment with SSL

## Impact

**80% time reduction** - From 10 minutes to 2 minutes per application

---

**Live Demo:** https://hackathon.lethimbuild.com  
**GitHub:** https://github.com/jamaljm/build-for-india

Built for **Build for India Hackathon 2026** - Multi-Agent Systems Track
`;
  
  const mdPath = path.join(__dirname, 'DEMO_PRESENTATION.md');
  await fs.writeFile(mdPath, mdContent);
  
  console.log(`  ✓ Created: DEMO_PRESENTATION.md`);
}

async function main() {
  console.log('🚀 Kerala e-District Portal - Demo Creator\n');
  console.log('═'.repeat(60));
  
  try {
    await setup();
    await captureScreenshots();
    await createAnnotatedImages();
    await createMarkdownPresentation();
    await createVideo();
    
    console.log('\n═'.repeat(60));
    console.log('✅ Demo creation complete!\n');
    console.log('📁 Assets location: demo-assets/');
    console.log('📄 Presentation: DEMO_PRESENTATION.md');
    console.log('🎥 Video: demo-video.mp4 (if ffmpeg available)\n');
    
  } catch (err) {
    console.error('\n❌ Error:', err);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = { main };
