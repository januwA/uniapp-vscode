/*
 * @Date: 2021-07-19 11:31:48
 * @LastEditors: E'vils
 * @LastEditTime: 2021-08-03 16:33:28
 * @Description:
 * @FilePath: /src/extension.ts
 */
/******************************************************************
MIT License http://www.opensource.org/licenses/mit-license.php
Author Mora <qiuzhongleiabc@126.com> (https://github.com/qiu8310)
*******************************************************************/

import * as path from "path";
import * as fs from "fs";
import * as url from "url";
import * as cjson from "comment-json";

import {
  ExtensionContext,
  languages,
  workspace,
  commands,
  window,
} from "vscode";

import LinkProvider from "./plugin/LinkProvider";
import ActiveTextEditorListener from "./plugin/ActiveTextEditorListener";
import WxmlDocumentHighlight from "./plugin/WxmlDocumentHighlight";

import { config, configActivate, configDeactivate } from "./plugin/lib/config";

export function activate(context: ExtensionContext) {
  // const currentlyOpenTabfilePath = window.activeTextEditor?.document.uri.fsPath;
  // console.log(currentlyOpenTabfilePath);

  // console.log('minapp-vscode is active!')
  configActivate();

  if (!config.disableAutoConfig) {
    autoConfig();
  }

  const linkProvider = new LinkProvider(config);
  const documentHighlight = new WxmlDocumentHighlight(config);

  const wxml = config.documentSelector.map((l) => schemes(l));
  const vue = schemes("vue");

  // 创建easycom组件命令
  const CreateComponent = commands.registerCommand(
    "uniapp.create-component",
    async (fileUri) => {
      if (!fileUri) return;

      const createDir = path.resolve(fileUri.fsPath);
      if (!createDir) return;
      const componentName = await window.showInputBox({
        placeHolder: "组件名称",
      });

      const d = path.join(createDir, componentName);
      const f = path.join(d, componentName + ".vue");
      if (fs.existsSync(f)) {
        window.showErrorMessage("文件已存在!");
        return;
      }

      fs.mkdirSync(d);

      fs.writeFileSync(
        f,
        `<template> <view></view></template>
<script> export default { name:"${componentName}", data() { return { }; } } </script>
<style lang="scss" scoped> </style>`
      );
    }
  );

  // easycom组件重新命名
  const RenameComponent = commands.registerCommand(
    "uniapp.rename-component",
    async (fileUri) => {
      if (!fileUri) return;

      const comDir = fileUri.fsPath; // 绝对路径
      const comParentDir = path.dirname(comDir);
      const oldName = path.basename(comDir);

      const newtName = await window.showInputBox({
        value: oldName,
        placeHolder: "组件名称",
      });
      if (!newtName) return;

      const comFile = path.join(comDir, `${oldName}.vue`);

      if (!fs.existsSync(comFile)) return;

      fs.renameSync(comFile,path.join(comDir, `${newtName}.vue`));
      fs.renameSync(comDir, path.join(comParentDir, newtName));
    }
  );

  // 创建页面命令
  const CreatePage = commands.registerCommand(
    "uniapp.create-page",
    async (fileUri) => {
      if (!fileUri) return;

      const createDir = path.resolve(fileUri.fsPath);
      if (!createDir) return;
      const pageName = await window.showInputBox({
        placeHolder: "页面名称",
      });

      const d = path.join(createDir, pageName);
      const f = path.join(d, pageName + ".vue");
      if (fs.existsSync(f)) {
        return window.showErrorMessage("文件已存在!");
      }

      // update pages.json
      const PAGES_JSON_NAME = "pages.json";
      let dd = createDir;
      let files = fs.readdirSync(dd);
      while (!files.includes(PAGES_JSON_NAME)) {
        files = fs.readdirSync((dd = path.dirname(dd)));
        if (dd === path.dirname(dd)) {
          return window.showErrorMessage(`未找到${PAGES_JSON_NAME}文件`);
        }
      }

      let pageUrl = null;
      for (const wf of workspace.workspaceFolders) {
        const d = path.resolve(wf.uri.fsPath);
        if (createDir.startsWith(d)) {
          pageUrl = url.parse(
            createDir.replace(d, "").replace(/^(\/|\\)+/, "")
          ).path;
        }
      }

      if (pageUrl === null)
        return window.showErrorMessage(`创建${PAGES_JSON_NAME}失败!`);

      const pagesFP = path.join(dd, PAGES_JSON_NAME);

      const pagesData: any = cjson.parse(
        fs.readFileSync(pagesFP, { encoding: "utf-8" }).toString()
      );

      pagesData.pages.push({
        path: path.posix.join(pageUrl, pageName, pageName),
        style: {
          navigationBarTitleText: "",
          enablePullDownRefresh: false,
        },
      });

      fs.writeFileSync(pagesFP, cjson.stringify(pagesData, null, 2), {
        encoding: "utf-8",
      });

      // create page file
      fs.mkdirSync(d);
      fs.writeFileSync(
        f,
        `<template><view></view></template><script> export default { data() { return { }; } } </script><style lang="scss" scoped> </style>`
      );
    }
  );

  context.subscriptions.push(
    RenameComponent,
    CreateComponent,
    CreatePage,

    //todo 给模板中的 脚本 添加特殊颜色
    new ActiveTextEditorListener(config),

    languages.registerDocumentLinkProvider([vue].concat(wxml), linkProvider),

    // 高亮匹配的标签
    languages.registerDocumentHighlightProvider(wxml, documentHighlight)
  );
}

export function deactivate() {
  configDeactivate();
}

function autoConfig() {
  let c = workspace.getConfiguration();
  const updates: { key: string; map: any }[] = [
    {
      key: "files.associations",
      map: {
        "*.cjson": "jsonc",
        "*.wxss": "css",
        "*.wxs": "javascript",
      },
    },
    {
      key: "emmet.includeLanguages",
      map: {
        wxml: "html",
      },
    },
  ];

  updates.forEach(({ key, map }) => {
    let oldMap = c.get(key, {}) as any;
    let appendMap: any = {};
    Object.keys(map).forEach((k) => {
      if (!oldMap.hasOwnProperty(k)) appendMap[k] = map[k];
    });
    if (Object.keys(appendMap).length) {
      c.update(key, { ...oldMap, ...appendMap }, true);
    }
  });

  c.update("uniapp-vscode.disableAutoConfig", true, true);
}

export function schemes(key: string) {
  return { scheme: "file", language: key };
}
