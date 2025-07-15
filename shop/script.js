// 表单提交处理
const contactForm = document.querySelector('#contact form');
if (contactForm) {
    contactForm.addEventListener('submit', function(e) {
        e.preventDefault();
        
        // 获取表单数据
        const formData = {
            name: this.querySelector('input[type="text"]').value,
            phone: this.querySelector('input[type="tel"]').value,
            message: this.querySelector('textarea').value
        };
        
        // 简单验证
        if (!formData.name || !formData.phone) {
            alert('请填写姓名和联系电话');
            return;
        }
        
        // 模拟提交成功
        alert(`感谢您的预约！${formData.name}，这是演示功能，我们会尽快开发完整服务`);
        this.reset();
    });
}

// 产品卡片悬停效果
const productCards = document.querySelectorAll('.product-card');
productCards.forEach(card => {
    card.addEventListener('mouseenter', () => {
        card.style.transition = 'transform 0.3s ease, box-shadow 0.3s ease';
        card.style.cursor = 'pointer';
    });
    
    card.addEventListener('mouseleave', () => {
        card.style.transition = 'transform 0.3s ease, box-shadow 0.3s ease';
    });
    
    card.addEventListener('click', () => {
        alert('产品详情功能正在开发中，敬请期待！');
    });
});

// 移动端菜单切换
const mobileMenuBtn = document.querySelector('button:has(.fa-bars)');
const navLinks = document.querySelector('.hidden.md\:flex');

if (mobileMenuBtn && navLinks) {
    mobileMenuBtn.addEventListener('click', () => {
        const isHidden = navLinks.classList.contains('hidden');
        
        // 添加动画效果
        navLinks.style.transition = 'all 0.3s ease';
        
        if (isHidden) {
            navLinks.classList.remove('hidden');
            navLinks.classList.add('flex', 'flex-col', 'absolute', 'top-16', 'left-0', 'right-0', 'bg-white', 'p-4', 'shadow-md');
            // 改变按钮图标
            mobileMenuBtn.innerHTML = '<i class="fas fa-times text-xl"></i>';
        } else {
            navLinks.classList.add('hidden');
            navLinks.classList.remove('flex', 'flex-col', 'absolute', 'top-16', 'left-0', 'right-0', 'bg-white', 'p-4', 'shadow-md');
            // 恢复按钮图标
            mobileMenuBtn.innerHTML = '<i class="fas fa-bars text-xl"></i>';
        }
    });

    // 点击菜单外区域关闭菜单
    document.addEventListener('click', (e) => {
        if (!navLinks.contains(e.target) && e.target !== mobileMenuBtn && !mobileMenuBtn.contains(e.target)) {
            navLinks.classList.add('hidden');
            navLinks.classList.remove('flex', 'flex-col', 'absolute', 'top-16', 'left-0', 'right-0', 'bg-white', 'p-4', 'shadow-md');
            mobileMenuBtn.innerHTML = '<i class="fas fa-bars text-xl"></i>';
        }
    });
}

// 导航栏滚动效果
const smoothScroll = (targetId) => {
    const targetElement = document.querySelector(targetId);
    if (targetElement) {
        window.scrollTo({
            top: targetElement.offsetTop - 80,
            behavior: 'smooth'
        });
    }
};

document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function(e) {
        e.preventDefault();
        const targetId = this.getAttribute('href');
        if(targetId === '#') return;
        
        // 如果是移动端菜单，点击后关闭菜单
        if (window.innerWidth < 768) {
            navLinks.classList.add('hidden');
            navLinks.classList.remove('flex', 'flex-col', 'absolute', 'top-16', 'left-0', 'right-0', 'bg-white', 'p-4', 'shadow-md');
            mobileMenuBtn.innerHTML = '<i class="fas fa-bars text-xl"></i>';
        }
        
        smoothScroll(targetId);
    });
});

// 移动端菜单切换
const mobileMenuBtn = document.querySelector('button:has(.fa-bars)');
const navLinks = document.querySelector('.hidden.md\:flex');

if (mobileMenuBtn && navLinks) {
    mobileMenuBtn.addEventListener('click', () => {
        navLinks.classList.toggle('hidden');
        navLinks.classList.toggle('flex');
        navLinks.classList.toggle('flex-col');
        navLinks.classList.toggle('absolute');
        navLinks.classList.toggle('top-16');
        navLinks.classList.toggle('left-0');
        navLinks.classList.toggle('right-0');
        navLinks.classList.toggle('bg-white');
        navLinks.classList.toggle('p-4');
        navLinks.classList.toggle('shadow-md');
    });
}
