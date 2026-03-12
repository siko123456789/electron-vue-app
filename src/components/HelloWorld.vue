<template>
  <div>
    <h1>Hello</h1>
    <button @click="add">点击</button>
  </div>
</template>

<script setup>
import { ref } from "vue"

const count = ref(0)

const add = () => {
  count.value++
}
</script>
