# Demo Assets - Kerala e-District Portal

This directory contains all assets needed to create a demo video for the hackathon project.

## Contents

- `01-landing.png` - Landing page screenshot
- `02-apply-scan-initial.png` - Aadhaar scan screen
- `03-form-empty.png` - Empty application form
- `README.md` - This file

## Quick Video Creation

### Option 1: Automated (Requires ffmpeg)

```bash
cd ..
chmod +x create-video.sh
./create-video.sh
```

This creates a 15-second slideshow video: `demo-video.mp4`

### Option 2: Manual Editing (Recommended for Best Quality)

Use any video editing software:

1. **DaVinci Resolve** (Free, Professional)
2. **iMovie** (Mac)
3. **OpenShot** (Linux/Free)
4. **Adobe Premiere** (Paid)

**Timeline:**
- 0-5s: Landing page + narration
- 5-10s: Aadhaar scan screen + narration
- 10-15s: Form screen + narration

**Narration Script** (see `../demo-script.md`)

### Option 3: Online Tools (No Installation)

- **Canva Video** (canva.com/create/videos)
- **Clipchamp** (clipchamp.com)
- **Kapwing** (kapwing.com)

Upload the 3 PNG files, set 5s duration each, add text overlays and narration.

## Live Demo Recording

For the best demo video, record the actual application in use:

### Tools

- **OBS Studio** (obs.com) - Professional screen recording
- **Loom** (loom.com) - Quick browser recording
- **QuickTime** (Mac) - Built-in screen recording

### Script

Follow the detailed script in `../demo-script.md` for a 3-4 minute walkthrough.

### Settings

- **Resolution:** 1920x1080 (Full HD)
- **Frame Rate:** 30 fps
- **Bitrate:** 5-8 Mbps (high quality)
- **Audio:** 48kHz, clear narration

## Quick Tips

### Recording Aadhaar Scan

Since you need camera access:

1. Use a mobile device to demo
2. Or use a sample Aadhaar card image
3. Or create a mockup for demo purposes

### Voice Demo

Record yourself saying:
> "My email is john.doe@gmail.com and my phone is 9876543210. I need an income certificate."

Show the real-time form filling as you speak.

### B-Roll

Add visual interest:
- Government office queues (contrast)
- Mobile phone using the app
- Multi-agent architecture diagram
- Happy user completing application

## Adding Narration

Once you have `demo-video.mp4`:

```bash
# Record narration or use TTS
ffmpeg -i demo-video.mp4 -i narration.mp3 \
  -c:v copy -c:a aac \
  -map 0:v:0 -map 1:a:0 \
  demo-final.mp4
```

## Text Overlays (if using video editor)

**Landing Page:**
- Title: "Kerala e-District Portal"
- Subtitle: "AI-Powered Certificate Application"
- Features: Voice • Document Scan • Multi-Agent

**Aadhaar Scan:**
- Title: "Step 1: Scan Aadhaar"
- Subtitle: "GPT-4 Vision OCR"
- Highlight: "Auto-extract all details"

**Form:**
- Title: "Step 2: Voice-Powered Form"
- Subtitle: "Speak naturally"
- Highlight: "Real-time filling"

## Final Touches

1. Add fade in/out transitions
2. Include background music (low volume)
3. Add captions/subtitles for accessibility
4. End screen with:
   - GitHub link
   - Live demo URL
   - Hackathon name

---

**Need help?** Check `../demo-script.md` for the full walkthrough script.
