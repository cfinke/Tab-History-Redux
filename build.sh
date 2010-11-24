rm -rf .tmp_xpi_dir/

chmod -R 0777 tab-history-redux/

mkdir .tmp_xpi_dir/
cp -r tab-history-redux/* .tmp_xpi_dir/

rm -rf `find ./.tmp_xpi_dir/ -name ".DS_Store"`
rm -rf `find ./.tmp_xpi_dir/ -name "Thumbs.db"`
rm -rf `find ./.tmp_xpi_dir/ -name ".svn"`
rm -rf `find ./.tmp_xpi_dir/ -name ".git"`

cd .tmp_xpi_dir/
zip -rq ~/Desktop/tab-history-redux.xpi *
cd ../
rm -rf .tmp_xpi_dir/
