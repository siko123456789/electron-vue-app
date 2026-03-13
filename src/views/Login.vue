<template>
  <div class="login-container">
    <div class="login-box">

      <!-- logo111122 -->
      <div class="logo-area">
        <img :src="logoSrc" class="logo" />
        <h2 class="title">{{ title }}</h2>
      </div>

      <!-- 表单 -->
      <el-form
        ref="formRef"
        :model="form"
        :rules="rules"
        label-position="top"
      >
        <el-form-item label="服务器地址" prop="apiBase">
          <el-input
            v-model="form.apiBase"
            placeholder="例如 https://10.10.10.99（留空则走本地 /api 代理）"
            clearable
          />
        </el-form-item>

        <el-form-item prop="user">
          <el-input
            v-model="form.user"
            placeholder="请输入用户名"
            prefix-icon="User"
            @keyup.enter="handleLogin"
          />
        </el-form-item>

        <el-form-item prop="password">
          <el-input
            v-model="form.password"
            type="password"
            placeholder="请输入密码"
            show-password
            prefix-icon="Lock"
            @keyup.enter="handleLogin"
          />
        </el-form-item>

        <!-- 验证码 -->
        <el-form-item v-if="captcha">
          <div class="captcha-box">
            <el-input
              v-model="form.code"
              placeholder="验证码"
              @keyup.enter="handleLogin"
            />
            <canvas ref="captchaCanvas" width="100" height="40"></canvas>
          </div>
        </el-form-item>

        <el-button
          type="primary"
          class="login-btn"
          :loading="loading"
          @click="handleLogin"
        >
          登录
        </el-button>
      </el-form>

    </div>

    <div class="footer">
      © 澜弧科技有限公司
    </div>
  </div>
</template>

		<script setup>
		import { ref, reactive, onMounted } from "vue"
	import { useRouter } from "vue-router"
	import { ElMessage } from "element-plus"
	import { login as loginApi } from "@/api/login"
	import { useAuthStore } from "@/stores/auth"
	import { useSettingsStore } from "@/stores/settings"

	const router = useRouter()
	const authStore = useAuthStore()
	const settingsStore = useSettingsStore()

const formRef = ref()
const captchaCanvas = ref()

const loading = ref(false)

	// Use BASE_URL so it works for both dev server and file:// production build.
	const logoSrc = `${import.meta.env.BASE_URL}lanhu_logo.png`
	const title = ref("风险治理系统")

const captcha = ref(false)

	const form = reactive({
	  apiBase: settingsStore.apiBase || "",
	  user: "",
	  password: "",
	  code: ""
	})

const rules = {
  user: [
    { required: true, message: "请输入用户名", trigger: "blur" }
  ],
  password: [
    { required: true, message: "请输入密码", trigger: "blur" }
  ]
}

	const handleLogin = async () => {

	  try {

	    await formRef.value.validate()

	    loading.value = true
	    settingsStore.setApiBase(form.apiBase)

	    const res = await loginApi({
	      user: form.user,
	      password: form.password,
	      code: form.code
	    })
    console.log(res,12345)
	    if (res.code === 0) {
	      const token = res?.data?.token || 'login-success-' + Date.now()
	      authStore.setAuth({ token, userInfo: res.data })
	      ElMessage.success("登录成功")
      router.push("/workbench")

    } else {

      ElMessage.error(res.msg || "登录失败")

    }

  } catch (e) {

    console.error(e)

  } finally {

    loading.value = false

  }

}

const renderCaptcha = (text) => {

  const canvas = captchaCanvas.value
  if (!canvas) return

  const ctx = canvas.getContext("2d")

  ctx.clearRect(0,0,canvas.width,canvas.height)

  ctx.font = "20px Arial"
  ctx.fillStyle = "#333"

  ctx.fillText(text,20,25)

}

onMounted(() => {

	  if (authStore.isLoggedIn) router.push("/workbench")

})
	</script>

<style scoped>

.login-container{
  width:100%;
  height:100%;
  display:flex;
  justify-content:center;
  align-items:center;
  background:#f5f7fa;
}

.login-box{
  width:420px;
  padding:40px;
  background:#fff;
  border-radius:10px;
  box-shadow:0 8px 30px rgba(0,0,0,0.1);
}

.logo-area{
  text-align:center;
  margin-bottom:30px;
}

.logo{
  width:60px;
}

.title{
  margin-top:10px;
  color:#7851a9;
}

.login-btn{
  width:100%;
  height:45px;
}

.captcha-box{
  display:flex;
  gap:10px;
}

.footer{
  position:fixed;
  bottom:10px;
  width:100%;
  text-align:center;
  font-size:12px;
  color:#888;
}

</style>
