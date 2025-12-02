# Multi-Device Setup Guide

This guide will help you work seamlessly on this project from both your Windows PC and MacBook.

## Repository Status

✅ Git repository initialized  
✅ All changes committed  
✅ Pushed to GitHub: `https://github.com/JhonnsonBourne/nfl-datamans-app.git`

## Making the Repository Private (if needed)

If your repository is currently public and you want to make it private:

1. Go to https://github.com/JhonnsonBourne/nfl-datamans-app
2. Click on **Settings** (top right of the repository page)
3. Scroll down to the **Danger Zone** section
4. Click **Change visibility**
5. Select **Make private**
6. Confirm by typing the repository name

## Setting Up on Your MacBook

### 1. Install Prerequisites

```bash
# Install Git (if not already installed)
git --version

# Install Python 3.9+ (if not already installed)
python3 --version

# Install Node.js 18+ (if not already installed)
node --version
```

### 2. Clone the Repository

```bash
# Navigate to where you want the project
cd ~/Projects  # or wherever you prefer

# Clone the repository
git clone https://github.com/JhonnsonBourne/nfl-datamans-app.git

# Navigate into the project
cd nfl-datamans-app
```

### 3. Set Up Python Environment

```bash
# Create a virtual environment
python3 -m venv venv

# Activate the virtual environment
source venv/bin/activate

# Install Python dependencies
pip install -r requirements.txt
```

### 4. Set Up Frontend

```bash
# Navigate to frontend directory
cd frontend

# Install Node.js dependencies
npm install

# Go back to root
cd ..
```

### 5. Configure Environment Variables (if needed)

```bash
# Copy example environment file (if it exists)
cp frontend/.env.example frontend/.env

# Edit .env file with your settings
# Note: .env files are gitignored and won't be committed
```

## Working Across Devices

### Daily Workflow

**On Windows:**
```bash
# Pull latest changes
git pull origin main

# Make your changes...

# Stage changes
git add .

# Commit
git commit -m "Your commit message"

# Push
git push origin main
```

**On MacBook:**
```bash
# Pull latest changes
git pull origin main

# Make your changes...

# Stage changes
git add .

# Commit
git commit -m "Your commit message"

# Push
git push origin main
```

### Best Practices

1. **Always pull before starting work**: `git pull origin main`
2. **Commit frequently**: Small, focused commits are better than large ones
3. **Push regularly**: Don't let changes accumulate too long
4. **Use descriptive commit messages**: Explain what and why
5. **Avoid conflicts**: If you're working on the same file on both devices, coordinate or use branches

### Handling Merge Conflicts

If you get a merge conflict:

```bash
# Git will show you which files have conflicts
git status

# Open the conflicted files and look for conflict markers:
# <<<<<<< HEAD
# (your changes)
# =======
# (other changes)
# >>>>>>> branch-name

# Edit the file to resolve conflicts, then:
git add <resolved-file>
git commit -m "Resolve merge conflict"
git push origin main
```

## Using Branches (Recommended for Parallel Work)

If you want to work on both devices simultaneously without conflicts:

```bash
# Create a new branch
git checkout -b feature-name

# Work on your changes...

# Commit and push the branch
git push origin feature-name

# On the other device, pull the branch
git fetch origin
git checkout feature-name

# Merge branches when ready
git checkout main
git merge feature-name
git push origin main
```

## Cursor IDE Tips

- Cursor works great with Git repositories
- You can use the built-in Git UI in Cursor for commits and pushes
- Both devices can work on the same repository simultaneously
- Cursor will show you uncommitted changes and let you commit directly from the IDE

## Troubleshooting

### "Permission denied" when pushing
- Make sure you're authenticated with GitHub
- Use SSH keys or GitHub CLI for authentication

### "Repository not found"
- Check that the repository exists and you have access
- Verify the remote URL: `git remote -v`

### Line ending issues (Windows vs Mac)
- Git should handle this automatically with the `.gitattributes` file
- If you see issues, run: `git config core.autocrlf true` (Windows) or `git config core.autocrlf input` (Mac)

## Quick Reference

```bash
# Check status
git status

# See what's changed
git diff

# View commit history
git log --oneline

# Undo last commit (keep changes)
git reset --soft HEAD~1

# Undo last commit (discard changes)
git reset --hard HEAD~1

# See remote repository info
git remote -v
```

