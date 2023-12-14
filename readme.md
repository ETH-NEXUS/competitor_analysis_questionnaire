# ETHZ - NEXUS - Full Stack Template

This template should be used when starting up a new project with the default NEXUS stack.

Core tech:

- Django
- Vue
- Quasar
- PostgreSQL

## Setup Steps 🚀:

This process has two main parts. If you would like to **setup a new project** complete the tasks in both parts. On the other hand, if you would only like to **try out the project** and play around with different features skip to the second part.

### 1. Setting up a New Project 🏗️

1. Copy the files into a new project repository.
2. Change instances of `fsex` to `your_project_name` in 6 files.
3. Rename `api/app/fsex` to `api/app/your_project_name`.
4. Delete the content of the following files in the `api/app/core` folder: `models` / `admin` / `serializers` / `endpoints` (leave only the default endpoint).
5. Delete everything in the `api/app/core/migrations` folder except the init file.
6. Remove the BookList component from the `ui/app/src/components` folder, it’s use in the `ui/app/src/pages/IndexPage.vue` file and type declarations related to the component in `/ui/app/src/components/models.ts`.

### 2. Running This Project 🔧

1. Create an `.env` file in the main directory and copy the content of the `.env.TEMPLATE` in it.
2. Adjust the `.env` file values based on your needs and preferences. The values set in this file will be used for configuring different services of the project (e.g. Django settings, database settings and Quasar settings)
3. Install postgres on your machine (On MacOS use `brew install postgresql`.)
4. To make life easier install the [power-user-tools](https://github.com/dameyerdave/power-user-tools) using `pipenv run pip install power-user-tools`.
5. Install [pipenv](https://pipenv.pypa.io/en/latest/)
6. Make sure to configure pipenv
   - Install using pip
   - Navigate to the root project directory and run `pipenv --python 3.x` to create a virtual environment.
   - Run `pipenv install -r ./api/requirements.dev.txt` to install the dependencies in requirements.dev.txt and requirements.txt.
   - Later use `pipenv install <package>` instead of the standard pip command.
   - Run `pipenv --venv` to get the path and the name of the project environemnt
   - [for vscode] Open the command palette and run the command `Python: Select Interpreter`. Your environment should start with the project name followed by a hash. Opening
7. Run `dcc up` to start the project and create containers.
8. In a separate container navigate to the root project directory and run `dcc -s api` to get into the api container. Then run `python manage.py makemigrations` to create migration files and `python manage.py migrate` to apply the changes.
9. Visit `localhost:8077/admin` and login using the user and password defined in the `.env` file. It can happen that the changes are not immediatelly accepted and you have to shut down your containers and run them again for the admin user to be accepted.
10. **[Optional if you skipped part 1]** Create a dummy book and an author for the book. Then visit the frontend on `localhost:8077` to see the frontend and the book.
11. **[Optional]** Update existing python requirements and install new ones.
12. Adjust the `readme.md` at the root of the project to describe your project and provide relevant information for it.

Congratulations you're done!

## URLs

- `localhost:8077` = Application UI
- `localhost:8077/admin` = Admin panel
- `localhost:8077/api` = API UI with option to execute API calls directly

## Common Tasks

#### Updating Requirements

To update existing requirements to the latest versions navigate to the project root and run `pipenv run pur -r ./api/requirements.dev.txt`. Once updated run `pipenv install -r ./api/requirements.dev.txt` to install the updated dependecy versions. You may need to also install the dependancies inside of your docker container separatley using `pip install`.

### Adding New Requirements

Run `pipenv run pip install <package_name>`. Once installed add the package name to the requirements file together with it's version. You may need to also install the dependancies inside of your docker container separatley using `pip install`.
