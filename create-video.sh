#!/bin/bash

# Simple video creator from screenshots
# Creates a slideshow-style demo video

DEMO_DIR="./demo-assets"
OUTPUT="demo-video.mp4"

echo "🎥 Creating demo video from screenshots..."

# Create concat file for ffmpeg
cat > ${DEMO_DIR}/concat.txt << EOF
file '01-landing.png'
duration 5
file '02-apply-scan-initial.png'
duration 5
file '03-form-empty.png'
duration 5
file '03-form-empty.png'
EOF

# Create video with fade transitions
ffmpeg -y \
  -f concat \
  -safe 0 \
  -i ${DEMO_DIR}/concat.txt \
  -vf "scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2,fade=t=in:st=0:d=0.5,fade=t=out:st=14.5:d=0.5" \
  -c:v libx264 \
  -pix_fmt yuv420p \
  -r 30 \
  ${OUTPUT}

echo "✅ Video created: ${OUTPUT}"
echo ""
echo "To add narration:"
echo "  ffmpeg -i ${OUTPUT} -i narration.mp3 -c:v copy -c:a aac -map 0:v:0 -map 1:a:0 demo-video-with-audio.mp4"
