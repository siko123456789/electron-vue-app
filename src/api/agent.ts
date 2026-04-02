import request from '@/utils/request'

type ApiData = Record<string, any> | any[] | undefined
type ApiParams = Record<string, any> | undefined

export function agentInstallAPI(data?: ApiData) {
  return request({
    url: '/abutment/agent/agentInstall',
    method: 'post',
    data
  })
}

export function agentNameIsAvailableAPI(params?: ApiParams) {
  return request({
    url: '/abutment/agent/queryAgentNameIsAvailable',
    method: 'get',
    params
  })
}

export function groupList() {
  return request({
    url: '/abutment/agent/queryAgentGroup',
    method: 'get'
  })
}

export function createGroup(data?: ApiData) {
  return request({
    url: '/abutment/agent/createAgentGroup',
    method: 'post',
    data
  })
}

export function queryAgentRule(params?: ApiParams) {
  return request({
    url: '/abutment/agent/queryAgentRule',
    method: 'get',
    params
  })
}

export function batchAgentRule(data?: ApiData) {
  return request({
    url: '/abutment/agent/batchAgentRule',
    method: 'post',
    data
  })
}

export function agentIsInstalled(data?: ApiData) {
  return request({
    url: '/abutment/agent/agentIsInstalled',
    method: 'post',
    data
  })
}
