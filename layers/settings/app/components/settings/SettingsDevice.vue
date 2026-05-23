<script setup lang="ts">
const deviceStore = useDeviceStore()

/** 接続試行中の API 識別子（'bluetooth' | 'hid' | 'serial' | null） */
const deviceConnecting = ref<string | null>(null)

/** ブラウザの Web Bluetooth API 対応状況 */
const hasBluetooth = computed(() => import.meta.client && 'bluetooth' in navigator)
/** ブラウザの WebHID API 対応状況 */
const hasHid = computed(() => import.meta.client && 'hid' in navigator)
/** ブラウザの Web Serial API 対応状況 */
const hasSerial = computed(() => import.meta.client && 'serial' in navigator)

/** Bluetooth デバイスへの接続を試みる */
async function handleConnectBluetooth(): Promise<void> {
  deviceConnecting.value = 'bluetooth'
  try {
    await deviceStore.connectBluetooth()
  } catch {
    // ユーザーによるキャンセルまたはエラーは無視
  } finally {
    deviceConnecting.value = null
  }
}

/** HID デバイスへの接続を試みる */
async function handleConnectHid(): Promise<void> {
  deviceConnecting.value = 'hid'
  try {
    await deviceStore.connectHid()
  } catch {
    // ユーザーによるキャンセルまたはエラーは無視
  } finally {
    deviceConnecting.value = null
  }
}

/** シリアルポートへの接続を試みる */
async function handleConnectSerial(): Promise<void> {
  deviceConnecting.value = 'serial'
  try {
    await deviceStore.connectSerial()
  } catch {
    // ユーザーによるキャンセルまたはエラーは無視
  } finally {
    deviceConnecting.value = null
  }
}

/** Gamepad ポーリング用 RAF ID */
let gamepadRafId: number | null = null

function pollGamepads(): void {
  deviceStore.updateGamepads()
  gamepadRafId = requestAnimationFrame(pollGamepads)
}

onMounted(() => {
  deviceStore.initGamepad()
  gamepadRafId = requestAnimationFrame(pollGamepads)
})

onUnmounted(() => {
  deviceStore.destroyGamepad()
  if (gamepadRafId !== null) {
    cancelAnimationFrame(gamepadRafId)
    gamepadRafId = null
  }
})
</script>

<template>
  <div class="section-content">
    <h3 class="section-title">
      {{ $t('apps.settings.device') }}
    </h3>

    <!-- Bluetooth -->
    <div class="field">
      <div class="device-section-header">
        <p class="field-label">
          <UIcon
            name="i-lucide-bluetooth"
            class="device-api-icon"
          />
          {{ $t('apps.settings.deviceBluetooth') }}
        </p>
        <UButton
          v-if="hasBluetooth"
          size="xs"
          icon="i-lucide-plus"
          :label="$t('apps.settings.deviceConnect')"
          :loading="deviceConnecting === 'bluetooth'"
          variant="outline"
          color="primary"
          @click="handleConnectBluetooth"
        />
      </div>
      <UAlert
        v-if="!hasBluetooth"
        icon="i-lucide-info"
        color="neutral"
        variant="soft"
        :description="$t('apps.settings.deviceNotSupported')"
        class="device-unsupported"
      />
      <div
        v-else-if="deviceStore.bluetoothDevices.length === 0"
        class="device-empty"
      >
        {{ $t('apps.settings.deviceNoDevices') }}
      </div>
      <div
        v-else
        class="device-list"
      >
        <div
          v-for="d in deviceStore.bluetoothDevices"
          :key="d.id"
          class="device-item"
        >
          <UIcon
            name="i-lucide-bluetooth"
            class="device-item-icon"
          />
          <span class="device-item-name">{{ d.name }}</span>
          <UButton
            size="xs"
            :label="$t('apps.settings.deviceDisconnect')"
            variant="ghost"
            color="error"
            @click="deviceStore.disconnectBluetooth(d.id)"
          />
        </div>
      </div>
    </div>

    <!-- HID -->
    <div class="field">
      <div class="device-section-header">
        <p class="field-label">
          <UIcon
            name="i-lucide-usb"
            class="device-api-icon"
          />
          {{ $t('apps.settings.deviceHid') }}
        </p>
        <UButton
          v-if="hasHid"
          size="xs"
          icon="i-lucide-plus"
          :label="$t('apps.settings.deviceConnect')"
          :loading="deviceConnecting === 'hid'"
          variant="outline"
          color="primary"
          @click="handleConnectHid"
        />
      </div>
      <UAlert
        v-if="!hasHid"
        icon="i-lucide-info"
        color="neutral"
        variant="soft"
        :description="$t('apps.settings.deviceNotSupported')"
        class="device-unsupported"
      />
      <div
        v-else-if="deviceStore.hidDevices.length === 0"
        class="device-empty"
      >
        {{ $t('apps.settings.deviceNoDevices') }}
      </div>
      <div
        v-else
        class="device-list"
      >
        <div
          v-for="d in deviceStore.hidDevices"
          :key="d.id"
          class="device-item"
        >
          <UIcon
            name="i-lucide-usb"
            class="device-item-icon"
          />
          <span class="device-item-name">{{ d.productName }}</span>
          <span class="device-item-meta">{{ d.vendorId.toString(16).padStart(4, '0') }}:{{ d.productId.toString(16).padStart(4, '0') }}</span>
          <UButton
            size="xs"
            :label="$t('apps.settings.deviceDisconnect')"
            variant="ghost"
            color="error"
            @click="deviceStore.disconnectHid(d.id)"
          />
        </div>
      </div>
    </div>

    <!-- シリアル -->
    <div class="field">
      <div class="device-section-header">
        <p class="field-label">
          <UIcon
            name="i-lucide-plug"
            class="device-api-icon"
          />
          {{ $t('apps.settings.deviceSerial') }}
        </p>
        <UButton
          v-if="hasSerial"
          size="xs"
          icon="i-lucide-plus"
          :label="$t('apps.settings.deviceConnect')"
          :loading="deviceConnecting === 'serial'"
          variant="outline"
          color="primary"
          @click="handleConnectSerial"
        />
      </div>
      <UAlert
        v-if="!hasSerial"
        icon="i-lucide-info"
        color="neutral"
        variant="soft"
        :description="$t('apps.settings.deviceNotSupported')"
        class="device-unsupported"
      />
      <div
        v-else-if="deviceStore.serialPorts.length === 0"
        class="device-empty"
      >
        {{ $t('apps.settings.deviceNoDevices') }}
      </div>
      <div
        v-else
        class="device-list"
      >
        <div
          v-for="p in deviceStore.serialPorts"
          :key="p.id"
          class="device-item"
        >
          <UIcon
            name="i-lucide-plug"
            class="device-item-icon"
          />
          <span class="device-item-name">{{ p.label }}</span>
          <UButton
            size="xs"
            :label="$t('apps.settings.deviceDisconnect')"
            variant="ghost"
            color="error"
            @click="deviceStore.disconnectSerial(p.id)"
          />
        </div>
      </div>
    </div>

    <!-- ゲームパッド -->
    <div class="field">
      <p class="field-label">
        <UIcon
          name="i-lucide-gamepad-2"
          class="device-api-icon"
        />
        {{ $t('apps.settings.deviceGamepad') }}
      </p>
      <div
        v-if="deviceStore.gamepads.length === 0"
        class="device-empty"
      >
        {{ $t('apps.settings.deviceGamepadGuide') }}
      </div>
      <div
        v-else
        class="gamepad-list"
      >
        <div
          v-for="gp in deviceStore.gamepads"
          :key="gp.index"
          class="gamepad-card"
        >
          <div class="gamepad-header">
            <UIcon name="i-lucide-gamepad-2" />
            <span class="gamepad-name">{{ gp.id }}</span>
            <UBadge
              size="xs"
              :label="gp.connected ? $t('apps.settings.deviceGamepadConnected') : $t('apps.settings.deviceGamepadDisconnected')"
              :color="gp.connected ? 'success' : 'neutral'"
              variant="soft"
            />
          </div>
          <div class="gamepad-buttons-section">
            <p class="gamepad-sub-label">
              {{ $t('apps.settings.deviceGamepadButtons') }}
            </p>
            <div class="gamepad-buttons">
              <span
                v-for="(btn, i) in gp.buttons"
                :key="i"
                class="gamepad-btn"
                :class="btn.pressed ? 'pressed' : ''"
                :title="$t('apps.settings.deviceGamepadButtonTitle', { index: i, value: (btn.value * 100).toFixed(0) })"
              />
            </div>
          </div>
          <div class="gamepad-axes-section">
            <p class="gamepad-sub-label">
              {{ $t('apps.settings.deviceGamepadAxes') }}
            </p>
            <div class="gamepad-axes">
              <div
                v-for="(axis, i) in gp.axes"
                :key="i"
                class="gamepad-axis"
              >
                <span class="gamepad-axis-label">{{ i }}</span>
                <div class="gamepad-axis-track">
                  <div
                    class="gamepad-axis-fill"
                    :style="{ left: '50%', width: `${Math.abs(axis) * 50}%`, transform: axis < 0 ? 'translateX(-100%)' : 'translateX(0)' }"
                  />
                  <div
                    class="gamepad-axis-thumb"
                    :style="{ left: `${(axis + 1) / 2 * 100}%` }"
                  />
                </div>
                <span class="gamepad-axis-value">{{ axis.toFixed(2) }}</span>
              </div>
            </div>
          </div>
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

.device-section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.5rem;

  .field-label {
    margin-bottom: 0;
  }
}

.device-api-icon {
  font-size: 1rem;
}

.device-empty {
  font-size: 0.8125rem;
  color: var(--ui-text-muted);
  padding: 0.375rem 0;
}

.device-unsupported {
  margin-top: 0.25rem;
}

.device-list {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
}

.device-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.375rem 0.625rem;
  border: 1px solid var(--ui-border);
  border-radius: var(--ui-radius);
  background: var(--ui-bg-elevated);
  font-size: 0.8125rem;

  .device-item-icon {
    color: var(--ui-primary);
    flex-shrink: 0;
  }

  .device-item-name {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .device-item-meta {
    font-family: ui-monospace, monospace;
    font-size: 0.75rem;
    color: var(--ui-text-muted);
    flex-shrink: 0;
  }
}

.gamepad-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.gamepad-card {
  border: 1px solid var(--ui-border);
  border-radius: var(--ui-radius);
  padding: 0.75rem;
  background: var(--ui-bg-elevated);
}

.gamepad-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.75rem;

  .gamepad-name {
    flex: 1;
    font-size: 0.75rem;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}

.gamepad-sub-label {
  font-size: 0.75rem;
  font-weight: 500;
  color: var(--ui-text-muted);
  margin: 0 0 0.375rem;
}

.gamepad-buttons-section,
.gamepad-axes-section {
  margin-bottom: 0.5rem;

  &:last-child {
    margin-bottom: 0;
  }
}

.gamepad-buttons {
  display: flex;
  flex-wrap: wrap;
  gap: 0.3rem;
}

.gamepad-btn {
  display: inline-block;
  width: 1.125rem;
  height: 1.125rem;
  border-radius: 50%;
  border: 1.5px solid var(--ui-border);
  background: transparent;
  transition: background-color 0.06s, border-color 0.06s;

  &.pressed {
    background: var(--ui-primary);
    border-color: var(--ui-primary);
  }
}

.gamepad-axes {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
}

.gamepad-axis {
  display: flex;
  align-items: center;
  gap: 0.5rem;

  .gamepad-axis-label {
    font-size: 0.6875rem;
    color: var(--ui-text-muted);
    width: 1rem;
    text-align: right;
    flex-shrink: 0;
  }

  .gamepad-axis-value {
    font-size: 0.6875rem;
    font-family: ui-monospace, monospace;
    color: var(--ui-text-muted);
    width: 3rem;
    flex-shrink: 0;
    text-align: right;
  }
}

.gamepad-axis-track {
  flex: 1;
  height: 0.5rem;
  background: var(--ui-bg);
  border-radius: 99px;
  position: relative;
  overflow: hidden;
  border: 1px solid var(--ui-border);

  .gamepad-axis-fill {
    position: absolute;
    top: 0;
    height: 100%;
    background: var(--ui-primary);
    opacity: 0.6;
  }

  .gamepad-axis-thumb {
    position: absolute;
    top: 50%;
    width: 0.5rem;
    height: 0.5rem;
    background: var(--ui-primary);
    border-radius: 50%;
    transform: translate(-50%, -50%);
  }
}
</style>
