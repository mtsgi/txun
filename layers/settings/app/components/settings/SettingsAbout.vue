<script setup lang="ts">
import licenseNuxt from '../../../../../node_modules/nuxt/LICENSE?raw'
import licenseNuxtUi from '../../../../../node_modules/@nuxt/ui/LICENSE.md?raw'
import licenseVue from '../../../../../node_modules/vue/LICENSE?raw'
import licensePinia from '../../../../../node_modules/pinia/LICENSE?raw'
import licenseI18n from '../../../../../node_modules/@nuxtjs/i18n/LICENSE?raw'
import licenseProseMirror from '../../../../../node_modules/prosemirror-state/LICENSE?raw'

/** Lucide Icons（@iconify-json/lucide）の ISC ライセンス全文 */
const LUCIDE_ISC = `ISC License

Copyright (c) for portions of Lucide are held by Cole Bemis 2013-2022 as part of Feather (MIT). All other copyright (c) for Lucide are held by Lucide Contributors 2022.

Permission to use, copy, modify, and/or distribute this software for any
purpose with or without fee is hereby granted, provided that the above
copyright notice and this permission notice appear in all copies.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY
AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM
LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR
OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
PERFORMANCE OF THIS SOFTWARE.`

const ossPackages = [
  { name: 'Nuxt', license: 'MIT', fullText: licenseNuxt },
  { name: 'Nuxt UI', license: 'MIT', fullText: licenseNuxtUi },
  { name: 'Vue', license: 'MIT', fullText: licenseVue },
  { name: 'Pinia', license: 'MIT', fullText: licensePinia },
  { name: '@nuxtjs/i18n', license: 'MIT', fullText: licenseI18n },
  { name: 'ProseMirror', license: 'MIT', fullText: licenseProseMirror },
  { name: 'Lucide Icons', license: 'ISC', fullText: LUCIDE_ISC }
]

/** 展開中の OSS パッケージ名 */
const openOss = ref<string | null>(null)
</script>

<template>
  <div class="section-content">
    <h3 class="section-title">
      {{ $t('apps.settings.about') }}
    </h3>
    <div class="about-logo">
      <UIcon
        name="i-lucide-monitor"
        class="about-icon"
      />
      <span class="about-name">TxunOS</span>
    </div>
    <p class="about-desc">
      {{ $t('apps.settings.aboutDescription') }}
    </p>
    <div class="field">
      <p class="field-label">
        {{ $t('apps.settings.version') }}
      </p>
      <p class="about-value">
        0.1.0
      </p>
    </div>
    <div class="field">
      <p class="field-label">
        {{ $t('apps.settings.license') }}
      </p>
      <p class="about-value">
        MIT
      </p>
    </div>
    <div class="field">
      <p class="field-label">
        {{ $t('apps.settings.ossLicenses') }}
      </p>
      <div class="oss-list">
        <div
          v-for="oss in ossPackages"
          :key="oss.name"
          class="oss-item"
        >
          <button
            class="oss-header"
            @click="openOss = openOss === oss.name ? null : oss.name"
          >
            <span class="oss-name">{{ oss.name }}</span>
            <span class="oss-license">{{ oss.license }}</span>
            <UIcon
              :name="openOss === oss.name ? 'i-lucide-chevron-up' : 'i-lucide-chevron-down'"
              class="oss-chevron"
            />
          </button>
          <pre
            v-if="openOss === oss.name"
            class="oss-full-text"
          >{{ oss.fullText }}</pre>
        </div>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.section-content {
  padding: 1.25rem;

  .section-title {
    font-size: 1rem;
    font-weight: 600;
    margin: 0 0 1rem;
  }
}

.field {
  margin-bottom: 1.25rem;
}

.field-label {
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--ui-text-muted);
  margin: 0 0 0.5rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.about-logo {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 1rem;

  .about-icon {
    font-size: 2.5rem;
    color: var(--ui-primary);
  }

  .about-name {
    font-size: 1.5rem;
    font-weight: 700;
  }
}

.about-desc {
  font-size: 0.875rem;
  color: var(--ui-text-muted);
  margin: 0 0 1.25rem;
  line-height: 1.6;
}

.about-value {
  font-size: 0.875rem;
  margin: 0;
}

.oss-list {
  display: flex;
  flex-direction: column;
  border: 1px solid var(--ui-border);
  border-radius: var(--ui-radius);
  overflow: hidden;
}

.oss-item {
  border-bottom: 1px solid var(--ui-border);

  &:last-child {
    border-bottom: none;
  }

  .oss-header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    width: 100%;
    padding: 0.5rem 0.75rem;
    background: none;
    border: none;
    cursor: pointer;
    color: inherit;
    text-align: left;
    font-size: 0.8125rem;
    transition: background-color 0.1s;

    &:hover {
      background: var(--ui-bg-elevated);
    }

    .oss-name {
      flex: 1;
      font-weight: 500;
    }

    .oss-license {
      color: var(--ui-text-muted);
    }

    .oss-chevron {
      margin-left: auto;
      color: var(--ui-text-muted);
    }
  }

  .oss-full-text {
    font-family: ui-monospace, monospace;
    font-size: 0.6875rem;
    line-height: 1.6;
    white-space: pre-wrap;
    word-break: break-word;
    padding: 0.75rem;
    margin: 0;
    background: var(--ui-bg-elevated);
    color: var(--ui-text-muted);
    border-top: 1px solid var(--ui-border);
    max-height: 16rem;
    overflow-y: auto;
  }
}
</style>
