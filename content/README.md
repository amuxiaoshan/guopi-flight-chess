# OC 内容包与一键换主题

这个项目把**飞行棋玩法代码**和**OC / 同人美术 / 角色名 / 语录 / UI**分开管理。现用资料包的内部名称只叫 `oc`，不使用任何世界观名称。

## 文件位置

```text
content/
├─ active.json                        # 当前启用的内容包：oc 或 example
├─ packs/
│  ├─ oc/
│  │  ├─ pack.json                    # 角色名字、文字棋子、台词、颜色、UI 文案、资源路径
│  │  └─ assets/
│  │     └─ popoya-original.png      # 原始图片字节；后续可添加更多角色/美术
│  └─ example/
│     └─ pack.json                    # 不包含原创 OC 角色和台词的替换模板
scripts/
└─ build-content-pack.py              # 把内容包编译进联机/离线游戏
public/
├─ content-pack.js                    # 自动生成，别手工修改
├─ content/assets/                    # 自动生成的网页素材，别手工修改
├─ app.js                              # 通用游戏前端
├─ single.html                         # 自动内嵌素材的离线独立版
└─ ...
server.js                              # 通用房间与游戏规则
```

## 怎么换角色或做同人版本

1. **保留原版**：先复制整个 `content/packs/example/` 文件夹，起个新英文标识，如 `fan-game`。
2. 编辑新文件夹下的 `pack.json`：每位角色的 `name`、`mark`、`collision` 数组和 `pieceImage` 图片路径。角色内部 ID **A～H** 暂时保持不变（对应现有八个可选位置）；可以重新命名为任何人物。
3. 把你做的 **透明 PNG**、新棋盘图、结算图、背景图、Logo 和 UI 样式表放在 `assets/` 中；在 JSON 中填写相对路径，如 `assets/character-a.png`。图片原始像素不做滤镜或改画；程序只改变显示尺寸。
4. 编辑 `pack.json` 的 `art.board`、`art.logoImage`、`art.resultImage`、`art.backgroundImage` 和 `art.uiCss`，指定要替换的界面素材。暂无素材可以填 `null`，默认游戏界面继续正常显示。
5. 修改 `ui` 中的首页标题、副标题、游戏内名称、下载文件名和欢迎介绍。颜色写在 `teams` 中，顺序始终是蓝、黄、绿、红。
6. **一键切换**：打开 GitHub 仓库 → **Actions** → **Build selected OC content pack** → **Run workflow** → 选内容包 → 运行。或者直接修改 `content/active.json` 中的 `active` 字段并提交，工作流会自动编译。工作流里手动下拉目前仅提供 `oc` 和 `example`；新增包后可以修改下拉选项，或直接编辑 `active.json`。
7. 构建通过后，部署新版本即可。独立离线版 `public/single.html` 会自动把角色图及自定义 UI 素材内嵌，下载一个 HTML 就可以断网游玩。实际切换前可以备份当前资料包。

本地也能直接运行：

```sh
python3 scripts/build-content-pack.py --use example
# 或切回自有内容：
python3 scripts/build-content-pack.py --use oc
npm start
```

## 具体可改字段

```json
{
  "characters": {
    "A": {
      "name": "角色名字",
      "mark": "字",
      "pieceImage": "assets/character-a.png",
      "collision": ["碰撞时说的话一", "碰撞时说的话二"]
    }
  },
  "art": {
    "board": "/board.svg",
    "logoImage": "assets/logo.png",
    "resultImage": "assets/result.png",
    "backgroundImage": "assets/background.png",
    "uiCss": "assets/custom-ui.css"
  },
  "ui": {
    "welcomeTitle": "首页标题",
    "welcomeSubtitle": "首页副标题",
    "gameTitle": "对局中标题",
    "documentTitle": "浏览器页签",
    "downloadName": "单人游戏.html",
    "welcomeDescription": "首页介绍"
  }
}
```

*这只列出格式示例，不是要整段覆盖原本的 pack.json。* `pieceImage` 未提供时使用文字棋子；有图时使用图片。角色仍使用统一的 **60 静止 → 85 移动 → 60 落地**。到终点前超点折返规则由核心代码决定，与更换角色无关。

## 版权和引用

- 自己的原创 OC、角色文字和美术与通用程序**分别管理**。内容包分离不代表素材开放任意转载、二次发布或商业利用。
- 同人游戏需遵守所涉及原作的相关授权政策。第三方图片、字体、音乐、代码如果要求署名/保留许可证，请保留原文、来源、链接和具体使用范围；没有明确可用授权时不要擅自复制。
- 已有棋盘资源的来源与许可注释不得在替换素材或改编时删除；其它第三方音频和代码的许可信息也要继续保留。
- `public/content-pack.js`、`public/content/assets/`、`public/single.html` 是构建产物。改角色资料时应编辑 `content/packs/<包名>/pack.json` 和该包的 `assets/`，不要反向修改生成文件。
