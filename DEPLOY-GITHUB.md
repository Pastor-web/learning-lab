# 用 GitHub + Pages 免费公开网站

## 本地已完成（若已 `git init` + commit）

仓库在：`C:\Users\Animamm\Desktop\FDE学习`

---

## 你在网页上做（约 5 分钟）

### 1. 注册 / 登录 GitHub

https://github.com

### 2. 新建公开仓库

1. 右上角 **+** → **New repository**
2. Repository name：建议 `fde-learning-lab`（英文）
3. 选 **Public**
4. **不要**勾选 “Add a README”（本地已有文件）
5. 点 **Create repository**

### 3. 把本地推上去

在 PowerShell 里执行（把 `你的用户名` 换成真实 GitHub 用户名）：

```powershell
cd "C:\Users\Animamm\Desktop\FDE学习"

git remote add origin https://github.com/你的用户名/fde-learning-lab.git
git branch -M main
git push -u origin main
```

- 若提示登录：用浏览器登录，或使用 **Personal Access Token** 当密码  
- 也可用 [GitHub Desktop](https://desktop.github.com/)：Add Local Repository → 选此文件夹 → Publish repository（勾选 Public）

### 4. 打开 GitHub Pages

1. 打开仓库页 → **Settings**
2. 左侧 **Pages**
3. Source：`Deploy from a branch`
4. Branch：`main`，文件夹：`/ (root)`
5. **Save**
6. 等 1～3 分钟，页面出现：

```text
https://你的用户名.github.io/fde-learning-lab/
```

用手机流量打开测一遍即可。

### 5.（可选）Cloudflare Pages

1. 注册 https://dash.cloudflare.com  
2. Workers & Pages → Create → Connect to Git → 选刚推的仓库  
3. 构建设置：框架 **None**，输出目录留空或 `/`  
4. 部署后得到 `https://xxx.pages.dev`

---

## 以后改网站

```powershell
cd "C:\Users\Animamm\Desktop\FDE学习"
# 改完文件后
git add .
git commit -m "Update site"
git push
```

几分钟内 Pages 会自动更新。

---

## 注意

- 仓库保持 **Public**，Pages 才对免费公开站最省事  
- 不要上传密钥；本站无密钥  
- 站内致谢（XDash 与延伸文作者）请保留  
