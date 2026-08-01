import { Entity, type A11yAttributes, type IRenderer } from '@vectojs/core';
import { Button, Tabs, Text, UIComponent } from '@vectojs/ui';

import type { DanmakuKitLabels } from '../labels';
import type { DanmakuKitTheme } from '../theme';
import type { LabAvailableBounds } from './LabPanel';

export interface DanmakuLabPanel extends Entity {
  setAvailableBounds(bounds: Readonly<LabAvailableBounds>): void;
}

export interface DanmakuLabTab<TabId extends string> {
  id: TabId;
  label: string;
  panel: DanmakuLabPanel;
}

export interface DanmakuLabDrawerOptions<TabId extends string> {
  theme: Readonly<DanmakuKitTheme>;
  labels: Readonly<DanmakuKitLabels['lab']>;
  panels: ReadonlyArray<Readonly<DanmakuLabTab<TabId>>>;
  open: boolean;
  activeTab: TabId;
  onOpenChange: (open: boolean) => void;
  onActiveTabChange: (tabId: TabId) => void;
}

/** A placement-agnostic drawer surface that keeps injected panel instances alive. */
export class DanmakuLabDrawer<TabId extends string> extends UIComponent {
  private readonly title: Text;
  private readonly closeButton: Button;
  private readonly tabs: Tabs;
  private open: boolean;

  constructor(private readonly options: DanmakuLabDrawerOptions<TabId>) {
    super();
    if (options.panels.length === 0) throw new Error('DanmakuLabDrawer requires at least one panel');
    if (!options.panels.some((tab) => tab.id === options.activeTab)) {
      throw new Error('DanmakuLabDrawer activeTab must identify an injected panel');
    }

    this.title = new Text(options.labels.title, {
      font: options.theme.fontDisplay,
      color: options.theme.text,
      maxWidth: 1,
    });
    this.closeButton = new Button(options.labels.close, {
      height: 36,
      bg: options.theme.surfaceRaised,
      hoverBg: options.theme.accentHover,
      color: options.theme.text,
      font: options.theme.fontUi,
      radius: options.theme.radius,
      onClick: () => {
        this.setOpen(false);
        options.onOpenChange(false);
      },
    });
    this.closeButton.width = Math.min(120, Math.max(72, this.closeButton.textWidth + 24));

    this.tabs = new Tabs({
      tabs: options.panels.map((tab) => ({ id: tab.id, label: tab.label, content: tab.panel })),
      value: options.activeTab,
      width: 1,
      height: 1,
      tabHeight: 44,
      tabWidth: 112,
      minTabWidth: 80,
      font: options.theme.fontLabel,
      color: options.theme.textMuted,
      selectedColor: options.theme.accent,
      borderColor: options.theme.border,
      onChange: (tabId) => options.onActiveTabChange(tabId as TabId),
    });

    this.open = !options.open;
    this.setOpen(options.open);
  }

  setOpen(open: boolean): void {
    if (this.open === open) return;
    this.open = open;
    this.interactive = open;
    this.a11yHidden = !open;
    this.opacity = open ? 1 : 0;

    if (open) {
      this.add(this.title, this.closeButton, this.tabs);
    } else {
      this.remove(this.title);
      this.remove(this.closeButton);
      this.remove(this.tabs);
    }
    this.scene?.markDirty();
  }

  setActiveTab(tabId: TabId): void {
    if (!this.options.panels.some((tab) => tab.id === tabId)) return;
    if (this.tabs.value === tabId) return;
    this.tabs.value = tabId;
    this.tabs.update(0, 0);
    this.scene?.markDirty();
  }

  setAvailableBounds(bounds: Readonly<LabAvailableBounds>): void {
    this.width = Math.max(0, bounds.width);
    this.height = Math.max(0, bounds.height);
    this.x = 0;
    this.y = 0;

    const padding = 12;
    const headerHeight = 40;
    const innerWidth = Math.max(0, this.width - padding * 2);
    this.title.x = padding;
    this.title.y = padding + 8;
    this.title.setMaxWidth(Math.max(1, innerWidth - this.closeButton.width - 12));
    this.closeButton.x = Math.max(padding, this.width - padding - this.closeButton.width);
    this.closeButton.y = padding;

    this.tabs.x = padding;
    this.tabs.y = padding + headerHeight;
    this.tabs.width = innerWidth;
    this.tabs.height = Math.max(0, this.height - this.tabs.y - padding);
    const panelBounds = {
      width: innerWidth,
      height: Math.max(0, this.tabs.height - this.tabs.effectiveTabBarHeight),
    };
    for (const tab of this.options.panels) tab.panel.setAvailableBounds(panelBounds);
    this.tabs.update(0, 0);
    this.scene?.markDirty();
  }

  get isOpen(): boolean {
    return this.open;
  }

  get activeTab(): TabId {
    return this.tabs.value as TabId;
  }

  override getA11yAttributes(): A11yAttributes {
    return {
      role: 'dialog',
      label: this.options.labels.title,
      pointerEvents: 'none',
    };
  }

  override render(renderer: IRenderer): void {
    if (!this.open) return;
    const forced = this.scene?.forcedColors ?? false;
    this.title.color = forced ? 'CanvasText' : this.options.theme.text;
    this.tabs.color = forced ? 'CanvasText' : this.options.theme.textMuted;
    this.tabs.selectedColor = forced ? 'Highlight' : this.options.theme.accent;
    this.tabs.borderColor = forced ? 'CanvasText' : this.options.theme.border;

    renderer.beginPath();
    renderer.roundRect(0, 0, this.width, this.height, 0);
    renderer.fill(forced ? 'Canvas' : this.options.theme.surface);
    renderer.stroke(forced ? 'CanvasText' : this.options.theme.border, 1);
  }
}
