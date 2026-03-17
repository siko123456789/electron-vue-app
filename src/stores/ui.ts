import { defineStore } from 'pinia'

type UiState = {
  messageCenterOpenToken: number
}

export const useUiStore = defineStore('ui', {
  state: (): UiState => ({
    messageCenterOpenToken: 0,
  }),
  actions: {
    requestOpenMessageCenter() {
      this.messageCenterOpenToken += 1
    },
  },
})

