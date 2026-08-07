# FDE 学习实验室

把范冰（**XDash**）开源书《前线部署工程师》做成可闯关的 **非官方、非盈利** 学习站，并收录社区延伸阅读。

## 特别感谢

### 主线作者

- **范冰（XDash）** — 开源全书  
  - 原书：https://github.com/xdash/FDE-the-Guidance-Book-of-Forward-Deployed-Engineer  
  - X：https://x.com/XDash  

### 延伸阅读作者

- **Punk（@AdrianPunk115）** — FDE 是什么、怎么转  
  https://x.com/AdrianPunk115/status/2083090241683128626  
- **阿哲Phil（@Formulasearch）** — 真假 FDE 怎么辨  
  https://x.com/Formulasearch/status/2083773600776262120  
- **阿哲Phil（@Formulasearch）** — 真 FDE 怎么入行  
  https://x.com/Formulasearch/status/2084158215596486804  

详见 [NOTICE.md](./NOTICE.md)。

## 功能

| 模块 | 作用 |
| --- | --- |
| 学习地图 | 交付旅程拆章；站内读原文 |
| 延伸阅读 | 三篇社区长文（站内可读 + 链回 X） |
| 情境 / 闪卡 / 测验 | 把书里的判断练成肌肉记忆 |
| 白天 / 黑夜 | 默认白天，可切换并记住 |

## 本地打开

```powershell
cd "C:\Users\Animamm\Desktop\FDE学习"
python -m http.server 8765
```

浏览器打开 http://127.0.0.1:8765 ，或双击 `index.html`。

## 公开部署（腾讯云 COS · 推荐国内访问）

完整点击步骤见：**[DEPLOY-TENCENT.md](./DEPLOY-TENCENT.md)**

摘要：

1. 腾讯云实名 → 开通 **对象存储 COS**  
2. 创建存储桶 → 开启 **静态网站**（索引 `index.html`）  
3. 权限设为 **公有读私有写**（或等效策略）  
4. 上传本目录文件（务必包含 `index.html`、`book-content.js`、`vendor/` 等）  
5. 用控制台给出的 `cos-website` 链接公网访问  
6. 费用中心设置预算告警  

新用户常有存储免费包（约 6 个月，以控制台为准）；**不是永久 0 元**，流量超出可能计费。

## 公开部署（GitHub Pages · 长期免费备选）

1. 新建 **公开** 仓库（建议名 `fde-learning-lab`）  
2. 推送本目录全部文件  
3. 仓库 Settings → Pages → Source: `main` / `/ (root)`  
4. 得到 `https://<用户名>.github.io/fde-learning-lab/`  

```powershell
cd "C:\Users\Animamm\Desktop\FDE学习"
git init
git add .
git commit -m "Publish non-commercial FDE learning lab with thanks"
git branch -M main
git remote add origin https://github.com/<你的用户名>/fde-learning-lab.git
git push -u origin main
```

部署后请在首页继续保留对 XDash 与三篇文章作者的致谢。

## 更新内容

```powershell
# 原书章节
python scripts\build_book.py

# 延伸阅读（改 essays 后）
python scripts\gen_essays.py
```

## 版权

- 主线原文 © 范冰（XDash）  
- 延伸文 © 各 X 作者  
- 本站非盈利、非官方；不设广告与付费墙  
