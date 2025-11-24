import os

def inject_skeletons(root_dir):
    header_skeleton = """
    <div class="skeleton-header container">
        <div class="skeleton-logo skeleton"></div>
        <div class="skeleton-nav">
            <div class="skeleton-link skeleton"></div>
            <div class="skeleton-link skeleton"></div>
            <div class="skeleton-link skeleton"></div>
            <div class="skeleton-link skeleton"></div>
            <div class="skeleton-link skeleton"></div>
        </div>
        <div class="skeleton-cta skeleton"></div>
    </div>
"""
    footer_skeleton = """
    <div class="container skeleton-footer">
        <div class="skeleton-footer-grid">
            <div class="skeleton-col">
                <div class="skeleton-title skeleton"></div>
                <div class="skeleton-text-line skeleton"></div>
                <div class="skeleton-text-line skeleton"></div>
                <div class="skeleton-text-line skeleton"></div>
            </div>
            <div class="skeleton-col">
                <div class="skeleton-title skeleton"></div>
                <div class="skeleton-text-line skeleton"></div>
                <div class="skeleton-text-line skeleton"></div>
            </div>
            <div class="skeleton-col">
                <div class="skeleton-title skeleton"></div>
                <div class="skeleton-text-line skeleton"></div>
                <div class="skeleton-text-line skeleton"></div>
            </div>
             <div class="skeleton-col">
                <div class="skeleton-title skeleton"></div>
                <div class="skeleton-text-line skeleton"></div>
                <div class="skeleton-text-line skeleton"></div>
            </div>
        </div>
    </div>
"""

    for dirpath, _, filenames in os.walk(root_dir):
        if 'node_modules' in dirpath or '.git' in dirpath:
            continue

        for filename in filenames:
            if filename.endswith('.html'):
                filepath = os.path.join(dirpath, filename)
                with open(filepath, 'r') as f:
                    content = f.read()

                new_content = content

                # Check if skeletons are already there to avoid duplication
                if 'skeleton-header' not in content:
                    new_content = new_content.replace(
                        '<div id="header-placeholder"></div>',
                        f'<div id="header-placeholder">{header_skeleton}</div>'
                    )

                if 'skeleton-footer' not in content:
                    new_content = new_content.replace(
                        '<div id="footer-placeholder"></div>',
                        f'<div id="footer-placeholder">{footer_skeleton}</div>'
                    )

                if new_content != content:
                    print(f"Injecting skeletons into {filepath}")
                    with open(filepath, 'w') as f:
                        f.write(new_content)

if __name__ == "__main__":
    inject_skeletons('.')
