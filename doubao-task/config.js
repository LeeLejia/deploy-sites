// 任务配置文件

// 任务 1: 新员工入职流程
const task0 = {
    id: 'task001',
    title: '新员工入职流程',
    description: '帮助新员工快速完成入职手续',
    image: 'https://zhiyan-ai-agent-with-1258344702.cos.ap-guangzhou.tencentcos.cn/with/c3f3d253-5872-4216-81e3-395277a4121c/image_1765365296_1_1.jpg',
    steps: [
        '前往人力资源部报到，领取员工手册和工牌',
        '完成入职信息登记，包括个人信息、银行账户等![办公设备示例](https://zhiyan-ai-agent-with-1258344702.cos.ap-guangzhou.tencentcos.cn/with/db76a3fc-1319-4860-bf40-a70ddaadca36/image_1765366006_1_1.jpg)kandedao ma ',
        '参加新员工培训，了解公司文化和规章制度',
        '领取办公设备（电脑、鼠标、键盘等）\n\n',
        '参加新员工培训22，了解公司文化和规章制度',
    ]
};

// 任务 2: 项目上线部署流程
const task1 = {
    id: 'task002',
    title: '项目上线部署流程',
    description: '确保项目安全稳定地部署到生产环境',
    image: 'https://zhiyan-ai-agent-with-1258344702.cos.ap-guangzhou.tencentcos.cn/with/ebbe675c-7ca2-4b35-a903-213250776a4d/image_1765365303_1_1.png',
    steps: [
        '**代码审查**：确保所有代码通过 Code Review',
        '运行完整的测试套件，确保所有测试用例通过',
        '更新项目文档和版本说明，详见 [部署文档](https://example.com/deploy-guide)',
        '在**测试环境**进行最终验证',
        '备份当前生产环境数据和配置',
        '执行数据库迁移脚本（如有需要），参考 [迁移指南](https://example.com/migration)'
    ]
};

// 任务 3: 客户问题处理流程
const task2 = {
    id: 'task003',
    title: '客户问题处理流程',
    description: '高效解决客户反馈的问题',
    image: 'https://zhiyan-ai-agent-with-1258344702.cos.ap-guangzhou.tencentcos.cn/with/f632a46e-37e6-4870-b070-b1b3aba16d72/image_1765365310_1_1.jpg',
    steps: [
        '接收客户反馈，记录问题详细信息',
        '评估问题优先级和影响范围',
        '分配给相应的技术支持人员',
        '分析问题原因，查找相关日志',
        '制定解决方案并与客户沟通'
    ]
};


// 任务 4: 示例任务配置
const task3 = {
    id: 'abc',
    title: '示例任务配置',
    description: '这是一个示例任务，展示如何配置任务步骤',
    image: 'https://zhiyan-ai-agent-with-1258344702.cos.ap-guangzhou.tencentcos.cn/with/811c3f2c-74b9-4af6-99e3-092f4648714f/image_1765365317_1_1.jpg',
    steps: [
        '这是第一个操作步骤，请仔细阅读并按照要求执行',
        '这是第二个操作步骤，确保前一步已完成',
        '这是第三个操作步骤，注意检查执行结果',
        '这是第四个操作步骤，如有问题及时反馈',
        '这是最后一个步骤，完成后进行整体验收'
    ]
};

// 导出任务列表
export const taskList = [
    task0,
    task1,
    task2,
    task3
];
