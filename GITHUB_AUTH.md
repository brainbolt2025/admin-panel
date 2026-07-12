# GitHub Authentication with Personal Access Token

## Step 1: Create a Personal Access Token

1. Go to GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic)
2. Click "Generate new token (classic)"
3. Give it a name (e.g., "Asine-Android-Repo")
4. Select scopes:
   - ✅ `repo` (full control of private repositories)
   - ✅ `workflow` (if you use GitHub Actions)
5. Click "Generate token"
6. **COPY THE TOKEN** - you won't see it again!

## Step 2: Update Git Remote URL

### Option A: Include token in URL (Quick but token visible in git config)

```bash
git remote set-url origin https://YOUR_TOKEN@github.com/brainbolt2025/Asine-Android.git
```

Replace `YOUR_TOKEN` with your actual token.

### Option B: Use Git Credential Helper (Recommended - more secure)

**Windows (PowerShell):**

```powershell
# Configure Git to use Windows Credential Manager
git config --global credential.helper manager-core

# Now when you push, Git will prompt for username and password
# Username: your GitHub username
# Password: paste your Personal Access Token (not your actual password)
git push origin main
```

**Linux/Mac:**

```bash
# Configure Git to cache credentials
git config --global credential.helper cache

# Or store permanently (less secure):
git config --global credential.helper store

# When prompted:
# Username: your GitHub username
# Password: paste your Personal Access Token
```

### Option C: Use GitHub CLI (Easiest)

```bash
# Install GitHub CLI (if not installed)
# Windows: winget install GitHub.cli
# Or download from: https://cli.github.com/

# Authenticate
gh auth login

# This will guide you through authentication
# Select: GitHub.com → HTTPS → Authenticate Git with your GitHub credentials
```

## Step 3: Verify Configuration

```bash
# Check your remote URL (should not show token in Option B/C)
git remote -v

# Test push
git push origin main
```

## Important Notes

⚠️ **Security Warning:**
- Never commit tokens to your repository
- If you used Option A, your token will be visible in `.git/config`
- Consider using Option B or C for better security
- Tokens can be revoked at any time in GitHub Settings

## Troubleshooting

**Error: "Authentication failed"**
- Make sure your token has the `repo` scope
- Verify the token hasn't expired
- Check that the username is correct

**Error: "remote: Support for password authentication was removed"**
- You MUST use a Personal Access Token, not your GitHub password
- Update your credentials using one of the methods above

**Remove stored credentials (if needed):**
```bash
# Windows - use Credential Manager:
# Search for "Credential Manager" in Windows → Manage Windows Credentials → Remove GitHub entries

# Or via command:
git credential-manager erase https://github.com
```

