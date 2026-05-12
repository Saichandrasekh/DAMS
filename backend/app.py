import os
from flask import Flask, render_template, session, jsonify
from flask_cors import CORS
from config import SECRET_KEY, UPLOAD_FOLDER
from database.db import init_db
from extensions import limiter
from routes.auth import auth_bp
from routes.superadmin import superadmin_bp
from routes.admin import admin_bp
from routes.teacher import teacher_bp
from routes.student import student_bp
from routes.parent import parent_bp
from routes.api_auth import api_auth_bp
from routes.api_superadmin import api_superadmin_bp
from routes.api_admin import api_admin_bp
from routes.api_teacher import api_teacher_bp
from routes.api_student import api_student_bp
from routes.api_parent import api_parent_bp

def create_app():
    app = Flask(__name__)
    app.secret_key = SECRET_KEY
    app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER

    CORS(
        app,
        resources={r"/api/*": {"origins": [
            "http://localhost:5173",
            "http://127.0.0.1:5173",
            "https://attend.kautech.co.in",
        ]}},
        supports_credentials=False,
    )

    limiter.init_app(app)

    @app.errorhandler(429)
    def ratelimit_handler(e):
        return jsonify({'error': 'Too many requests. Please wait and try again.'}), 429

    # Ensure upload directory exists
    os.makedirs(UPLOAD_FOLDER, exist_ok=True)

    # Register Blueprints
    app.register_blueprint(auth_bp)
    app.register_blueprint(superadmin_bp)
    app.register_blueprint(admin_bp)
    app.register_blueprint(teacher_bp)
    app.register_blueprint(student_bp)
    app.register_blueprint(parent_bp)
    app.register_blueprint(api_auth_bp)
    app.register_blueprint(api_superadmin_bp)
    app.register_blueprint(api_admin_bp)
    app.register_blueprint(api_teacher_bp)
    app.register_blueprint(api_student_bp)
    app.register_blueprint(api_parent_bp)

    app.jinja_env.filters['str'] = str

    @app.context_processor
    def inject_user():
        from middleware.auth import get_current_user
        return dict(user=get_current_user())

    @app.errorhandler(404)
    def page_not_found(e):
        return render_template('404.html'), 404

    return app

app = create_app()

if __name__ == '__main__':
    # Initialize DB on first run
    init_db()
    app.run(host='0.0.0.0', port=5000, debug=True)
