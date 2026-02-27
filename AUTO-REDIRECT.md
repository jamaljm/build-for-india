# 🔄 Automatic Navigation to Apply Page

## ✅ Feature Restored!

The agent can now **automatically navigate** users to the application form when they express intent to apply.

---

## 🎯 How It Works

### **User Flow:**

1. **User says:** "I want to apply for a birth certificate"
2. **Agent responds:** "Great! You'll need your hospital records and parent's IDs. Let me take you to the application form now."
3. **Page automatically redirects** to `/apply` after 1 second
4. **User lands on form page** with voice assistant ready

---

## 🗣️ Trigger Phrases

The agent must use **EXACTLY one of these phrases** to trigger auto-navigation:

### **Approved Trigger Phrases:**
- ✅ "Let me take you to the application form now"
- ✅ "I'm redirecting you to the application page"
- ✅ "Taking you to the application form now"
- ✅ "Let me take you to the application"
- ✅ "Redirecting you to the application"
- ✅ "Navigate to the application"
- ✅ "Go to the application page"

### **How Detection Works:**

**In Code (`src/app/App.tsx`):**
```typescript
// Listens for audio transcript
if (eventData.type === "response.audio_transcript.done") {
  const transcript = eventData.transcript.toLowerCase();
  
  if (
    transcript.includes("let me take you to the application") ||
    transcript.includes("redirecting you to the application") ||
    // ... other phrases
  ) {
    setTimeout(() => {
      window.location.href = "/apply";
    }, 1000); // 1 second delay
  }
}
```

---

## 🤖 Agent Instructions

**In Agent Config (`src/app/agentConfigs/keralaGovCertHelper/index.ts`):**

```
HOW TO HANDLE APPLICATION REQUESTS:
- When users express intent to apply, you can automatically navigate them
- To trigger automatic navigation, use EXACTLY one of these phrases:
  * "Let me take you to the application form now"
  * "I'm redirecting you to the application page"
  * "Taking you to the application form now"
- After using a trigger phrase, the page will automatically navigate
- You can explain requirements first, then navigate
```

---

## 💡 Example Conversations

### **Example 1: Immediate Navigation**

**User:** "I want to apply for a caste certificate"

**Agent:** "Certainly! Let me take you to the application form now where you can fill in your details using voice."

**Result:** Page redirects to `/apply` after 1 second

---

### **Example 2: Explain First, Then Navigate**

**User:** "How do I apply for an income certificate?"

**Agent:** "For an income certificate, you'll need proof of income like salary slips or tax returns, your Aadhaar card, and a passport-sized photo. The fee is Rs. 20 and processing takes 7 days. Let me take you to the application form now."

**Result:** Page redirects to `/apply` after 1 second

---

### **Example 3: User Not Ready**

**User:** "What documents do I need for a birth certificate?"

**Agent:** "For a birth certificate, you'll need hospital records showing the birth, both parents' IDs, and proof of residence. Would you like me to take you to the application form, or do you have more questions?"

**User:** "I have more questions"

**Agent:** "Of course! What would you like to know?"

**Result:** No redirect (trigger phrase not used)

---

## 🧪 Testing the Auto-Redirect

### **Test Script:**

1. **Go to:** https://hackathon.lethimbuild.com
2. **Click:** "Connect & Start Speaking"
3. **Say:** "I want to apply for a certificate"
4. **Expected:**
   - Agent explains briefly
   - Agent says: "Let me take you to the application form now"
   - Page redirects to `/apply` within 1-2 seconds
5. **Result:** You're on the form page with voice assistant active

---

## ⚙️ Technical Details

### **Event Detection:**

**Two detection points:**

**1. Audio Transcript (Primary):**
```typescript
eventData.type === "response.audio_transcript.done"
eventData.transcript // Contains what agent said verbally
```

**2. Text Content (Backup):**
```typescript
eventData.type === "response.content_part.added"
eventData.part?.type === "text"
eventData.part?.text // Contains text response
```

### **Navigation Logic:**

```typescript
// 1 second delay before redirect
setTimeout(() => {
  window.location.href = "/apply";
}, 1000);
```

**Why 1 second delay?**
- Gives user time to hear/see the agent's message
- Prevents jarring instant redirect
- Smooth UX transition

---

## 🎨 User Experience

### **What User Sees:**

**On Homepage:**
1. User speaks: "I want to apply"
2. Agent responds (voice + text): "Let me take you to the application form now"
3. **1 second pause** (user hears the message)
4. **Page fades** and redirects
5. **Lands on** `/apply` page

**On Apply Page:**
- Voice assistant already connected (if was connected on homepage)
- Can immediately start voice-filling the form
- Seamless experience

---

## 🐛 Troubleshooting

### **Issue: Redirect Not Working**

**Check:**

**1. Agent used correct phrase?**
```bash
# Check browser console:
"Navigation trigger detected in transcript: [phrase]"
```

**2. Service running?**
```bash
systemctl status hackathon
```

**3. JavaScript errors?**
```
Open browser console (F12)
Look for errors
```

### **Issue: Redirect Too Fast**

**Fix:** Increase delay in `src/app/App.tsx`:
```typescript
setTimeout(() => {
  window.location.href = "/apply";
}, 2000); // Change from 1000 to 2000 (2 seconds)
```

### **Issue: Agent Doesn't Use Trigger Phrases**

**Fix:** Agent needs clearer instructions. Update `keralaGovCertHelper/index.ts`:
```typescript
- ALWAYS use a trigger phrase when user wants to apply
- Don't ask "would you like to go to the form?" - just navigate them
```

---

## 📝 Best Practices

### **For Demo:**

**DO:**
- ✅ Explain requirements briefly, then navigate
- ✅ Use trigger phrases consistently
- ✅ Let user hear the navigation message

**DON'T:**
- ❌ Navigate without explanation (user won't know why)
- ❌ Ask if they want to go (just take them)
- ❌ Use partial trigger phrases (must be exact)

### **For Judges:**

**Script:**
> "Watch this—when I say I want to apply, the agent doesn't just tell me to click a button. It understands my intent and automatically takes me there. This is intelligent navigation."

**Then demonstrate:**
- Say: "I want to apply"
- Agent responds and navigates
- "See? Seamless voice-driven UX"

---

## 🔧 Customization

### **Add More Trigger Phrases:**

**Edit:** `src/app/App.tsx`

```typescript
// Add to the condition:
if (
  transcript.includes("let me take you to the application") ||
  transcript.includes("redirecting you to the application") ||
  transcript.includes("YOUR NEW PHRASE HERE") || // Add here
  // ... existing phrases
) {
  // Navigate
}
```

**Then update agent instructions** to use the new phrase.

---

## ✅ Summary

**Status:** ✅ **Auto-redirect WORKING**

**How It Works:**
- User expresses intent to apply
- Agent uses trigger phrase
- Page automatically navigates to `/apply`
- Seamless voice-driven UX

**Trigger Phrases:**
- "Let me take you to the application form now"
- "I'm redirecting you to the application page"
- "Taking you to the application form now"
- (Plus variations)

**Delay:** 1 second (configurable)

**Detection:** Audio transcript + text content

**Status:** Production ready ✅

---

**Test it now:** Say "I want to apply" and watch the magic! 🎯
